import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
  Game,
  GamePhase,
  GameStatus,
  GameWinner,
} from './entities/game.entity';
import { GamePlayer } from './entities/game-player.entity';
import { GameVote } from './entities/game-vote.entity';
import { GameAction } from './entities/game-action.entity';
import { GameActionType, SeerCheckResult } from './constants/actions';
import {
  GUARDIAN_ROLE,
  SEER_ROLE,
  WEREWOLF_ROLES,
  WITCH_ROLE,
} from './constants/factions';
import {
  ROLE_CONFIG_BY_MAX_PLAYERS,
  MaxPlayers,
} from '../rooms/constants/room-configs';
import { PHASE_DURATION_MS } from './constants/timing';

interface RoomStartedPayload {
  roomId: number;
  maxPlayers: number;
  memberIds: number[];
}

interface RoomDeletedPayload {
  roomId: number;
}

// Kết quả của 1 lần advanceGame(): hoặc ván vừa kết thúc (cần phát sự kiện game.finished
// SAU KHI transaction đã commit), hoặc ván tiếp tục sang 1 pha mới (cần hẹn giờ cho pha đó).
type AdvanceOutcome =
  | { type: 'finished'; roomId: number }
  | { type: 'continued'; phase: GamePhase };

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Game)
    private readonly gamesRepo: Repository<Game>,
    @InjectRepository(GamePlayer)
    private readonly playersRepo: Repository<GamePlayer>,
    @InjectRepository(GameVote)
    private readonly votesRepo: Repository<GameVote>,
    @InjectRepository(GameAction)
    private readonly actionsRepo: Repository<GameAction>,
    private readonly eventEmitter: EventEmitter2,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  @OnEvent('room.started')
  async handleRoomStarted(payload: RoomStartedPayload): Promise<void> {
    const existing = await this.gamesRepo.findOneBy({
      roomId: payload.roomId,
      status: GameStatus.IN_PROGRESS,
    });
    if (existing) {
      this.logger.warn(
        `Bỏ qua room.started trùng lặp cho room #${payload.roomId}`,
      );
      return;
    }

    try {
      // Tạo ván + chia vai trong CÙNG 1 transaction: nếu ghi game_players lỗi giữa chừng
      // thì dòng games vừa tạo cũng rollback theo, không để sót một ván "ma" — status
      // IN_PROGRESS nhưng 0 người chơi, khiến mọi người trong phòng bị 403 khi xem trạng
      // thái ván (players.some(...) luôn false trên mảng rỗng).
      const game = await this.dataSource.transaction(async (manager) => {
        const gamesRepo = manager.getRepository(Game);
        const playersRepo = manager.getRepository(GamePlayer);

        const newGame = await gamesRepo.save(
          gamesRepo.create({
            roomId: payload.roomId,
            status: GameStatus.IN_PROGRESS,
            phase: GamePhase.NIGHT,
            dayNumber: 0,
            phaseEndsAt: new Date(
              Date.now() + PHASE_DURATION_MS[GamePhase.NIGHT],
            ),
          }),
        );

        const roles = this.buildShuffledRoles(payload.maxPlayers);
        const players = payload.memberIds.map((userId, i) =>
          playersRepo.create({
            gameId: newGame.id,
            userId,
            role: roles[i],
            isAlive: true,
          }),
        );
        await playersRepo.save(players);

        return newGame;
      });

      // Hẹn giờ SAU KHI transaction đã commit — đây là side effect trong RAM, không phải
      // ghi DB, nên chỉ nên làm khi chắc chắn ván đã lưu thành công.
      this.schedulePhase(game.id, PHASE_DURATION_MS[GamePhase.NIGHT]);
    } catch (err) {
      this.logger.error(
        `Tạo ván cho room #${payload.roomId} thất bại`,
        err instanceof Error ? err.stack : undefined,
      );
      this.eventEmitter.emit('game.start_failed', {
        roomId: payload.roomId,
        reason: err instanceof Error ? err.message : 'unknown error',
      });
    }
  }

  @OnEvent('room.deleted')
  async handleRoomDeleted(payload: RoomDeletedPayload): Promise<void> {
    const games = await this.gamesRepo.find({
      where: { roomId: payload.roomId, status: GameStatus.IN_PROGRESS },
    });
    for (const game of games) {
      this.cancelPhase(game.id);
    }
    await this.gamesRepo.update(
      { roomId: payload.roomId, status: GameStatus.IN_PROGRESS },
      {
        status: GameStatus.CANCELLED,
        finishedAt: new Date(),
        phaseEndsAt: null,
      },
    );
  }

  /**
   * Trạng thái ván. Cố ý **không phụ thuộc người xem**: hai người trong cùng một ván gọi lên
   * sẽ nhận phản hồi y hệt nhau. Mọi thứ riêng tư (vai của mình, đồng đội Sói, kỹ năng) nằm
   * ở getMyState(). Nhờ tách như vậy, việc rà soát rò rỉ bí mật chỉ gói gọn ở một chỗ
   */
  async getGameState(roomId: number, userId: number) {
    const game = await this.gamesRepo.findOne({
      where: { roomId },
      order: { startedAt: 'DESC' },
    });
    // Phòng chưa chơi ván nào không phải lỗi — đó là trạng thái bình thường của phòng đang
    // chờ. Trả { game: null }
    if (!game) return { game: null };

    const players = await this.playersRepo.find({
      where: { gameId: game.id },
    });
    if (!players.some((p) => p.userId === userId)) {
      throw new ForbiddenException('Bạn không thuộc ván chơi này');
    }

    const isFinished = game.status !== GameStatus.IN_PROGRESS;

    return {
      game: {
        id: game.id,
        roomId: game.roomId,
        status: game.status,
        phase: game.phase,
        dayNumber: game.dayNumber,
        phaseEndsAt: game.phaseEndsAt,
        winner: game.winner,
        // Lộ vai khi CHÍNH NGƯỜI ĐÓ đã chết, hoặc khi ván đã kết thúc — và lộ cho tất cả
        // mọi người như nhau. Người xem đã chết KHÔNG vì thế mà thấy được vai của người
        // còn sống. "Sói nhìn thấy Sói" nằm ở getMyState() dưới dạng danh sách đồng đội.
        players: players.map((p) => ({
          userId: p.userId,
          isAlive: p.isAlive,
          role: !p.isAlive || isFinished ? p.role : null,
        })),
      },
    };
  }

  /**
   * Thông tin riêng của người gọi trong một ván: vai của mình, đồng đội (chỉ Sói mới có),
   * và hiện tại làm được gì. Đây là chỗ duy nhất trả dữ liệu bí mật, và danh tính luôn lấy
   * từ access token chứ không từ tham số client gửi lên.
   */
  async getMyState(gameId: number, userId: number) {
    const game = await this.gamesRepo.findOneBy({ id: gameId });
    if (!game) throw new NotFoundException('Không tìm thấy ván chơi');

    const players = await this.playersRepo.find({ where: { gameId } });
    const me = players.find((p) => p.userId === userId);
    if (!me) throw new ForbiddenException('Bạn không thuộc ván chơi này');

    const myVote = await this.votesRepo.findOneBy({
      gameId,
      phase: game.phase,
      dayNumber: game.dayNumber,
      voterId: userId,
    });

    const base = {
      userId: me.userId,
      role: me.role,
      isAlive: me.isAlive,
      canVoteNow: this.canVoteNow(game, me),
      myVoteTargetId: myVote?.targetId ?? null,
    };

    // Sói biết nhau từ đầu ván, kể cả đồng đội đã chết — cái biết đó không mất đi.
    if (WEREWOLF_ROLES.includes(me.role)) {
      return {
        ...base,
        teammates: players
          .filter((p) => p.userId !== userId && WEREWOLF_ROLES.includes(p.role))
          .map((p) => p.userId),
      };
    }

    // Tiên tri cần biết TRƯỚC khi bấm là đêm nay còn quyền soi không, và nếu soi rồi thì
    // kết quả là gì (để F5 hay đổi máy không mất thông tin). Xem docs/role-tien-tri.md §6.4.
    if (me.role === SEER_ROLE) {
      const check = await this.findAction(
        gameId,
        game.dayNumber,
        userId,
        GameActionType.SEER_CHECK,
      );
      return {
        ...base,
        seer: {
          canCheckNow: this.canUseSkillNow(game, me, GamePhase.NIGHT) && !check,
          checkedThisNight: check
            ? {
                targetUserId: check.targetId,
                isWerewolf: check.result === SeerCheckResult.WEREWOLF,
              }
            : null,
        },
      };
    }

    // Bảo vệ cần biết trước: đêm nay còn quyền che không, đã che ai, và ai đang bị cấm
    // vì mới che đêm trước. Không có thông tin nào ở đây là bí mật của người khác —
    // Bảo vệ vốn đã tự biết mình che ai.
    if (me.role === GUARDIAN_ROLE) {
      const [tonight, lastNight] = await Promise.all([
        this.findGuardianProtect(gameId, game.dayNumber, userId),
        this.findLastNightProtect(gameId, game.dayNumber, userId),
      ]);
      return {
        ...base,
        guardian: {
          canProtectNow:
            this.canUseSkillNow(game, me, GamePhase.NIGHT) && !tonight,
          protectedThisNight: tonight
            ? { targetUserId: tonight.targetId }
            : null,
          // Người không được chọn đêm nay vì đã che đêm trước — client tô mờ đi
          blockedTargetUserId: lastNight?.targetId ?? null,
        },
      };
    }

    // Phù thuỷ cần biết: còn thuốc nào không (xét CẢ VÁN), lượt này đã dùng thuốc nào chưa,
    // và nạn nhân của đêm nay — nhưng CHỈ khi đang ở pha kỹ năng (ngoài pha đó luôn rỗng,
    // xem docs/impl-phu-thuy.md §3.6).
    if (me.role === WITCH_ROLE) {
      const [poisonUsed, healUsed, poisonTonight, healTonight] =
        await Promise.all([
          this.findActionThisGame(gameId, userId, GameActionType.WITCH_POISON),
          this.findActionThisGame(gameId, userId, GameActionType.WITCH_HEAL),
          this.findAction(
            gameId,
            game.dayNumber,
            userId,
            GameActionType.WITCH_POISON,
          ),
          this.findAction(
            gameId,
            game.dayNumber,
            userId,
            GameActionType.WITCH_HEAL,
          ),
        ]);

      let victimTonight: number | null = null;
      if (game.phase === GamePhase.SKILL) {
        const wolfVotes = await this.votesRepo.find({
          where: { gameId, phase: GamePhase.NIGHT, dayNumber: game.dayNumber },
        });
        victimTonight = this.pickUniqueMaxTarget(this.tallyByTarget(wolfVotes));
      }

      return {
        ...base,
        witch: {
          canPoisonNow:
            this.canUseSkillNow(game, me, GamePhase.NIGHT) && !poisonUsed,
          canHealNow:
            this.canUseSkillNow(game, me, GamePhase.SKILL) &&
            !healUsed &&
            victimTonight !== null,
          poisonAvailable: !poisonUsed,
          healAvailable: !healUsed,
          victimTonight,
          poisonedThisNight: poisonTonight
            ? { targetUserId: poisonTonight.targetId }
            : null,
          healedThisNight: healTonight
            ? { targetUserId: healTonight.targetId }
            : null,
        },
      };
    }

    // Vai khác không có khoá `teammates`, `seer`, `guardian` lẫn `witch` — kể cả rỗng, vì
    // sự tồn tại của khoá cũng đã là một tín hiệu rò rỉ.
    return base;
  }

  /** Bây giờ bấm bỏ phiếu có được không — cùng bộ điều kiện castWolfVote/castLynchVote kiểm tra. */
  private canVoteNow(game: Game, me: GamePlayer): boolean {
    if (game.status !== GameStatus.IN_PROGRESS) return false;
    if (!me.isAlive) return false;
    if (game.phase === GamePhase.NIGHT) return WEREWOLF_ROLES.includes(me.role);
    if (game.phase === GamePhase.DAY) return true;
    return false; // SKILL — không ai bỏ phiếu được ở pha này
  }

  /**
   * Tiên tri soi 1 người trong đêm hiện tại, biết người đó có phải Sói hay không.
   * Ghi một lần, KHÔNG sửa được — xem docs/role-tien-tri.md §2.
   */
  async seerCheck(gameId: number, actorId: number, targetUserId: number) {
    const { game } = await this.assertCanUseSkill(
      gameId,
      actorId,
      SEER_ROLE,
      'Tiên tri',
      GamePhase.NIGHT,
    );

    // Luật riêng của Tiên tri: mỗi ĐÊM đúng 1 lần. Tầng chặn 1 — tầng 2 là ràng buộc UNIQUE
    // lúc ghi bên dưới, bịt khe hở giữa lúc kiểm tra và lúc ghi.
    if (
      await this.findAction(
        gameId,
        game.dayNumber,
        actorId,
        GameActionType.SEER_CHECK,
      )
    ) {
      throw new ConflictException('Đêm nay bạn đã dùng lượt soi rồi');
    }

    if (targetUserId === actorId) {
      throw new BadRequestException('Không thể tự soi chính mình');
    }

    const target = await this.assertLivingTarget(gameId, targetUserId);

    // Chỉ nhị phân — không lộ tên vai cụ thể.
    const isWerewolf = WEREWOLF_ROLES.includes(target.role);

    try {
      await this.actionsRepo.insert({
        gameId,
        dayNumber: game.dayNumber,
        actionType: GameActionType.SEER_CHECK,
        actorId,
        targetId: targetUserId,
        result: isWerewolf
          ? SeerCheckResult.WEREWOLF
          : SeerCheckResult.NOT_WEREWOLF,
      });
    } catch (err) {
      // Tầng chặn 2: 2 request song song cùng vượt qua tầng 1 rồi cùng ghi.
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('Đêm nay bạn đã dùng lượt soi rồi');
      }
      throw err;
    }

    return { dayNumber: game.dayNumber, targetUserId, isWerewolf };
  }

  /**
   * Bảo vệ chọn 1 người để che trong đêm nay. Nếu Sói cắn đúng người đó thì không ai chết.
   * Bảo vệ KHÔNG biết mình có che trúng hay không — biết được tức là biết luôn Sói nhắm ai.
   * Xem docs/role-bao-ve.md.
   */
  async guardianProtect(gameId: number, actorId: number, targetUserId: number) {
    const { game } = await this.assertCanUseSkill(
      gameId,
      actorId,
      GUARDIAN_ROLE,
      'Bảo vệ',
      GamePhase.NIGHT,
    );

    // Luật riêng của Bảo vệ: mỗi ĐÊM đúng 1 lần.
    if (
      await this.findAction(
        gameId,
        game.dayNumber,
        actorId,
        GameActionType.GUARDIAN_PROTECT,
      )
    ) {
      throw new ConflictException('Đêm nay bạn đã dùng kỹ năng rồi');
    }

    if (targetUserId === actorId) {
      throw new BadRequestException('Không thể tự bảo vệ chính mình');
    }

    // Không được che cùng một người 2 đêm liên tiếp — thiếu luật này thì Bảo vệ khoá cứng
    // được một người và phe Sói gần như không thể thắng.
    const lastNight = await this.findLastNightProtect(
      gameId,
      game.dayNumber,
      actorId,
    );
    if (lastNight?.targetId === targetUserId) {
      throw new BadRequestException(
        'Đêm trước bạn đã bảo vệ người này, không được chọn lại 2 đêm liên tiếp',
      );
    }

    await this.assertLivingTarget(gameId, targetUserId);

    try {
      await this.actionsRepo.insert({
        gameId,
        dayNumber: game.dayNumber,
        actionType: GameActionType.GUARDIAN_PROTECT,
        actorId,
        targetId: targetUserId,
        // Không có kết quả trả về: che trúng hay trượt đều không được báo.
        result: null,
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('Đêm nay bạn đã dùng kỹ năng rồi');
      }
      throw err;
    }

    // Cố ý KHÔNG trả bất cứ thông tin gì về mục tiêu (vai, phe, có bị nhắm không).
    return { dayNumber: game.dayNumber, targetUserId };
  }

  /** Lịch sử che của chính người gọi, từ đầu ván. */
  async getMyGuardianProtects(gameId: number, actorId: number) {
    const actor = await this.playersRepo.findOneBy({ gameId, userId: actorId });
    if (!actor) throw new ForbiddenException('Bạn không thuộc ván chơi này');
    if (actor.role !== GUARDIAN_ROLE) {
      throw new ForbiddenException('Chỉ Bảo vệ mới xem được lịch sử này');
    }

    const rows = await this.actionsRepo.find({
      where: {
        gameId,
        actionType: GameActionType.GUARDIAN_PROTECT,
        actorId,
      },
      order: { dayNumber: 'ASC' },
    });

    return {
      protects: rows.map((r) => ({
        dayNumber: r.dayNumber,
        targetUserId: r.targetId,
      })),
    };
  }

  /**
   * Phù thuỷ đầu độc 1 người bất kỳ đêm nay — dùng được ĐÚNG 1 LẦN CẢ VÁN. Bảo vệ không
   * chặn được, thuốc cứu không cứu được. Xem docs/impl-phu-thuy.md §3.5.
   */
  async witchPoison(gameId: number, actorId: number, targetUserId: number) {
    const { game } = await this.assertCanUseSkill(
      gameId,
      actorId,
      WITCH_ROLE,
      'Phù thuỷ',
      GamePhase.NIGHT,
    );

    // Luật riêng của Phù thuỷ: mỗi bình chỉ dùng 1 lần CẢ VÁN, không phải mỗi đêm — khác
    // Tiên tri/Bảo vệ nên không đưa vào assertCanUseSkill dùng chung.
    if (
      await this.findActionThisGame(
        gameId,
        actorId,
        GameActionType.WITCH_POISON,
      )
    ) {
      throw new ConflictException('Bạn đã dùng hết bình thuốc độc rồi');
    }

    if (targetUserId === actorId) {
      throw new BadRequestException('Không thể tự đầu độc chính mình');
    }

    await this.assertLivingTarget(gameId, targetUserId);

    try {
      await this.actionsRepo.insert({
        gameId,
        dayNumber: game.dayNumber,
        actionType: GameActionType.WITCH_POISON,
        actorId,
        targetId: targetUserId,
        result: null,
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('Bạn đã dùng hết bình thuốc độc rồi');
      }
      throw err;
    }

    return { dayNumber: game.dayNumber, targetUserId };
  }

  /**
   * Phù thuỷ cứu nạn nhân bị Sói cắn đêm nay — dùng được ĐÚNG 1 LẦN CẢ VÁN, chỉ ở pha SKILL.
   * KHÔNG nhận mục tiêu từ client: mục tiêu luôn là nạn nhân của lượt này, server tự tính rồi
   * tự ghi — để client gửi lên sẽ mở đường dò nạn nhân bằng cách thử từng id.
   * Xem docs/impl-phu-thuy.md §3.5.
   */
  async witchHeal(gameId: number, actorId: number) {
    const { game } = await this.assertCanUseSkill(
      gameId,
      actorId,
      WITCH_ROLE,
      'Phù thuỷ',
      GamePhase.SKILL,
    );

    // Luật riêng của Phù thuỷ: mỗi bình chỉ dùng 1 lần CẢ VÁN.
    if (
      await this.findActionThisGame(gameId, actorId, GameActionType.WITCH_HEAL)
    ) {
      throw new ConflictException('Bạn đã dùng hết bình thuốc cứu rồi');
    }

    const wolfVotes = await this.votesRepo.find({
      where: { gameId, phase: GamePhase.NIGHT, dayNumber: game.dayNumber },
    });
    const victimId = this.pickUniqueMaxTarget(this.tallyByTarget(wolfVotes));
    if (victimId === null) {
      throw new ConflictException('Đêm nay không có ai bị Sói cắn để cứu');
    }

    // Chiều chặn "vừa cứu vừa độc cùng một người" nằm ở ĐÂY: độc dùng ở NIGHT nên luôn xảy
    // ra trước cứu ở SKILL — xem docs/impl-phu-thuy.md §3.5.
    const poison = await this.findAction(
      gameId,
      game.dayNumber,
      actorId,
      GameActionType.WITCH_POISON,
    );
    if (poison?.targetId === victimId) {
      throw new BadRequestException(
        'Bạn vừa đầu độc chính người này, không thể cứu',
      );
    }

    try {
      await this.actionsRepo.insert({
        gameId,
        dayNumber: game.dayNumber,
        actionType: GameActionType.WITCH_HEAL,
        actorId,
        targetId: victimId,
        result: null,
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('Bạn đã dùng hết bình thuốc cứu rồi');
      }
      throw err;
    }

    return { dayNumber: game.dayNumber, targetUserId: victimId };
  }

  /** Lịch sử dùng cả 2 loại thuốc của chính người gọi, từ đầu ván. */
  async getMyWitchActions(gameId: number, actorId: number) {
    const actor = await this.playersRepo.findOneBy({ gameId, userId: actorId });
    if (!actor) throw new ForbiddenException('Bạn không thuộc ván chơi này');
    if (actor.role !== WITCH_ROLE) {
      throw new ForbiddenException('Chỉ Phù thuỷ mới xem được lịch sử này');
    }

    const rows = await this.actionsRepo.find({
      where: {
        gameId,
        actorId,
        actionType: In([
          GameActionType.WITCH_HEAL,
          GameActionType.WITCH_POISON,
        ]),
      },
      order: { dayNumber: 'ASC' },
    });

    return {
      actions: rows.map((r) => ({
        dayNumber: r.dayNumber,
        type: r.actionType,
        targetUserId: r.targetId,
      })),
    };
  }

  /**
   * Các kiểm tra CHUNG cho mọi kỹ năng — áp dụng như nhau bất kể vai gì: ván đang chạy,
   * đúng pha, đúng vai, còn sống. KHÔNG kiểm tra "đã dùng chưa" — phạm vi đó (mỗi đêm với
   * Tiên tri/Bảo vệ, cả ván với Phù thuỷ) là luật RIÊNG của từng vai, nên để đúng hàm xử lý
   * vai đó tự kiểm tra ngay sau khi gọi hàm này. Xem docs/impl-phu-thuy.md §3.4.
   */
  private async assertCanUseSkill(
    gameId: number,
    actorId: number,
    requiredRole: string,
    roleLabel: string,
    requiredPhase: GamePhase,
  ): Promise<{ game: Game; actor: GamePlayer }> {
    const game = await this.gamesRepo.findOneBy({ id: gameId });
    if (!game) throw new NotFoundException('Không tìm thấy ván chơi');
    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new ConflictException('Ván chơi đã kết thúc');
    }
    if (game.phase !== requiredPhase) {
      throw new ConflictException('Kỹ năng này chưa tới lượt dùng');
    }

    const actor = await this.playersRepo.findOneBy({ gameId, userId: actorId });
    if (!actor) throw new ForbiddenException('Bạn không thuộc ván chơi này');
    if (actor.role !== requiredRole) {
      throw new ForbiddenException(
        `Chỉ ${roleLabel} mới dùng được kỹ năng này`,
      );
    }
    if (!actor.isAlive) {
      throw new ForbiddenException('Bạn đã chết, không thể dùng kỹ năng');
    }

    return { game, actor };
  }

  private async assertLivingTarget(
    gameId: number,
    targetUserId: number,
  ): Promise<GamePlayer> {
    const target = await this.playersRepo.findOneBy({
      gameId,
      userId: targetUserId,
    });
    if (!target) throw new NotFoundException('Người chơi không thuộc ván này');
    if (!target.isAlive) {
      throw new ConflictException('Người chơi này đã chết');
    }
    return target;
  }

  /** Đêm nay có Bảo vệ nào che người này không (tra theo mục tiêu, không theo người che). */
  private async isProtected(
    actionsRepo: Repository<GameAction>,
    game: Game,
    targetId: number,
  ): Promise<boolean> {
    const row = await actionsRepo.findOneBy({
      gameId: game.id,
      dayNumber: game.dayNumber,
      actionType: GameActionType.GUARDIAN_PROTECT,
      targetId,
    });
    return row !== null;
  }

  /** Lượt che của đêm ngay trước đó, để cài luật "không trùng 2 đêm liên tiếp". */
  private findLastNightProtect(
    gameId: number,
    dayNumber: number,
    actorId: number,
  ): Promise<GameAction | null> {
    if (dayNumber === 0) return Promise.resolve(null); // đêm đầu, chưa có đêm trước
    return this.findGuardianProtect(gameId, dayNumber - 1, actorId);
  }

  /**
   * Lịch sử soi của CHÍNH người gọi từ đầu ván. Luôn lọc theo danh tính lấy từ access token,
   * không bao giờ theo tham số client gửi lên — xem docs/role-tien-tri.md §7.
   */
  async getMySeerChecks(gameId: number, actorId: number) {
    const actor = await this.playersRepo.findOneBy({ gameId, userId: actorId });
    if (!actor) throw new ForbiddenException('Bạn không thuộc ván chơi này');
    if (actor.role !== SEER_ROLE) {
      throw new ForbiddenException('Chỉ Tiên tri mới xem được lịch sử soi');
    }

    const checks = await this.actionsRepo.find({
      where: { gameId, actionType: GameActionType.SEER_CHECK, actorId },
      order: { dayNumber: 'ASC' },
    });

    return {
      checks: checks.map((c) => ({
        dayNumber: c.dayNumber,
        targetUserId: c.targetId,
        isWerewolf: c.result === SeerCheckResult.WEREWOLF,
      })),
    };
  }

  /** Bản ghi kỹ năng của MỘT NGƯỜI cụ thể trong MỘT LƯỢT cụ thể (mọi vai dùng theo lượt). */
  private findAction(
    gameId: number,
    dayNumber: number,
    actorId: number,
    actionType: GameActionType,
  ): Promise<GameAction | null> {
    return this.actionsRepo.findOneBy({
      gameId,
      dayNumber,
      actionType,
      actorId,
    });
  }

  /**
   * Bản ghi kỹ năng của MỘT NGƯỜI cụ thể trong CẢ VÁN, không quan tâm lượt nào — dùng cho
   * ràng buộc "1 lần cả ván" của 2 bình thuốc Phù thuỷ (xem docs/impl-phu-thuy.md §2.2).
   */
  private findActionThisGame(
    gameId: number,
    actorId: number,
    actionType: GameActionType,
  ): Promise<GameAction | null> {
    return this.actionsRepo.findOneBy({ gameId, actorId, actionType });
  }

  /**
   * Bản ghi kỹ năng của MỘT LƯỢT, không quan tâm ai thực hiện — dùng khi áp dụng cái chết
   * (resolveNightDeaths), lúc đó chỉ cần biết "có ai cứu/độc đêm nay không", không cần biết
   * là ai. Nhận `actionsRepo` của transaction vì luôn được gọi bên trong advanceGame().
   */
  private findActionOfType(
    actionsRepo: Repository<GameAction>,
    gameId: number,
    dayNumber: number,
    actionType: GameActionType,
  ): Promise<GameAction | null> {
    return actionsRepo.findOneBy({ gameId, dayNumber, actionType });
  }

  private findGuardianProtect(
    gameId: number,
    dayNumber: number,
    actorId: number,
  ): Promise<GameAction | null> {
    return this.findAction(
      gameId,
      dayNumber,
      actorId,
      GameActionType.GUARDIAN_PROTECT,
    );
  }

  /** Điều kiện chung để dùng kỹ năng NGAY LÚC NÀY. KHÔNG tính chuyện "đã dùng chưa" — phần
   *  đó tra riêng vì mỗi vai có loại hành động và phạm vi khác nhau. */
  private canUseSkillNow(
    game: Game,
    me: GamePlayer,
    requiredPhase: GamePhase,
  ): boolean {
    return (
      game.status === GameStatus.IN_PROGRESS &&
      game.phase === requiredPhase &&
      me.isAlive
    );
  }

  private isUniqueViolation(err: unknown): boolean {
    return (err as { code?: string })?.code === '23505';
  }

  /**
   * Các kiểm tra CHUNG cho mọi kiểu bỏ phiếu — áp dụng như nhau cho cắn lẫn treo cổ: ván
   * đang chạy, đúng pha, người bỏ phiếu thuộc ván và còn sống, mục tiêu thuộc ván và còn
   * sống. KHÔNG kiểm tra ai được vote hay vote được ai — luật "chỉ Sói mới vote, không được
   * chọn Sói khác" là luật RIÊNG của bỏ phiếu cắn, để castWolfVote() tự kiểm ngay sau khi
   * gọi hàm này (bỏ phiếu treo cổ không có luật nào thêm). Mỗi đường gọi tự khai báo đúng
   * pha của mình — KHÔNG có nhánh "mặc định cho phép" như hàm castVote() cũ, nên pha mới
   * thêm vào sau này tự động bị chặn. Xem docs/impl-phu-thuy.md §3.3, §3.4.
   */
  private async assertCanVote(
    gameId: number,
    voterId: number,
    targetUserId: number,
    requiredPhase: GamePhase,
  ): Promise<{ game: Game; voter: GamePlayer; target: GamePlayer }> {
    const game = await this.gamesRepo.findOneBy({ id: gameId });
    if (!game) throw new NotFoundException('Không tìm thấy ván chơi');
    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new ConflictException('Ván chơi đã kết thúc');
    }
    if (game.phase !== requiredPhase) {
      throw new ConflictException('Chưa tới lượt bỏ phiếu này');
    }

    const voter = await this.playersRepo.findOneBy({ gameId, userId: voterId });
    if (!voter) throw new ForbiddenException('Bạn không thuộc ván chơi này');
    if (!voter.isAlive) {
      throw new ForbiddenException('Bạn đã chết, không thể bỏ phiếu');
    }

    const target = await this.assertLivingTarget(gameId, targetUserId);

    return { game, voter, target };
  }

  private async upsertVote(
    gameId: number,
    phase: GamePhase,
    dayNumber: number,
    voterId: number,
    targetUserId: number,
  ): Promise<void> {
    const existingVote = await this.votesRepo.findOneBy({
      gameId,
      phase,
      dayNumber,
      voterId,
    });
    if (existingVote) {
      existingVote.targetId = targetUserId;
      await this.votesRepo.save(existingVote);
    } else {
      await this.votesRepo.save(
        this.votesRepo.create({
          gameId,
          phase,
          dayNumber,
          voterId,
          targetId: targetUserId,
        }),
      );
    }
  }

  /**
   * Sói bỏ/đổi phiếu chọn nạn nhân — chỉ dùng được ở pha NIGHT. Gọi lại nhiều lần trong
   * cùng lượt = đổi phiếu, không cộng dồn (UNIQUE theo gameId+phase+dayNumber+voterId).
   */
  async castWolfVote(gameId: number, voterId: number, targetUserId: number) {
    const { game, voter, target } = await this.assertCanVote(
      gameId,
      voterId,
      targetUserId,
      GamePhase.NIGHT,
    );

    // Luật riêng của bỏ phiếu cắn: chỉ Sói được vote, và không được chọn Sói khác (tự cắn
    // mình cũng nằm trong luật này). Không rò rỉ gì: chỉ Sói mới bỏ phiếu được ban đêm, mà
    // Sói vốn đã biết hết đồng đội.
    if (!WEREWOLF_ROLES.includes(voter.role)) {
      throw new ForbiddenException('Chỉ Sói được chọn nạn nhân ban đêm');
    }
    if (WEREWOLF_ROLES.includes(target.role)) {
      throw new BadRequestException('Ma Sói không thể cắn đồng đội');
    }

    await this.upsertVote(
      gameId,
      GamePhase.NIGHT,
      game.dayNumber,
      voterId,
      targetUserId,
    );
    return this.getWolfVoteTally(gameId, voterId);
  }

  /**
   * Cả làng bỏ/đổi phiếu treo cổ — chỉ dùng được ở pha DAY. Gọi lại nhiều lần trong cùng
   * lượt = đổi phiếu, không cộng dồn.
   */
  async castLynchVote(gameId: number, voterId: number, targetUserId: number) {
    const { game } = await this.assertCanVote(
      gameId,
      voterId,
      targetUserId,
      GamePhase.DAY,
    );
    // Không có luật riêng nào thêm — ai còn sống cũng vote được, chọn được bất kỳ ai kể cả Sói.
    await this.upsertVote(
      gameId,
      GamePhase.DAY,
      game.dayNumber,
      voterId,
      targetUserId,
    );
    return this.getLynchVoteTally(gameId, voterId);
  }

  /**
   * Kiểm phiếu của lượt hiện tại theo đúng 1 pha cố định. NIGHT chỉ Sói xem được (bàn bạc
   * kín), DAY ai còn trong ván cũng xem được (bỏ phiếu công khai).
   */
  private async getVoteTally(
    gameId: number,
    requesterId: number,
    phase: GamePhase,
    wolfOnly: boolean,
  ) {
    const game = await this.gamesRepo.findOneBy({ id: gameId });
    if (!game) throw new NotFoundException('Không tìm thấy ván chơi');

    const requester = await this.playersRepo.findOneBy({
      gameId,
      userId: requesterId,
    });
    if (!requester)
      throw new ForbiddenException('Bạn không thuộc ván chơi này');

    if (wolfOnly && !WEREWOLF_ROLES.includes(requester.role)) {
      throw new ForbiddenException('Chỉ Ma Sói được xem phiếu ban đêm');
    }

    const votes = await this.votesRepo.find({
      where: { gameId, phase, dayNumber: game.dayNumber },
    });

    const tally = this.tallyByTarget(votes);
    const myVote = votes.find((v) => v.voterId === requesterId);

    return {
      phase,
      dayNumber: game.dayNumber,
      phaseEndsAt: game.phaseEndsAt,
      myVoteTargetId: myVote?.targetId ?? null,
      tally: [...tally.entries()]
        .map(([targetUserId, count]) => ({ targetUserId, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async getWolfVoteTally(gameId: number, requesterId: number) {
    return this.getVoteTally(gameId, requesterId, GamePhase.NIGHT, true);
  }

  async getLynchVoteTally(gameId: number, requesterId: number) {
    return this.getVoteTally(gameId, requesterId, GamePhase.DAY, false);
  }

  /**
   * Hết giờ một pha: NIGHT → SKILL (nếu còn Phù thuỷ sống, ngược lại xử lý cái chết và mở
   * luôn DAY) → SKILL đóng thì xử lý cái chết rồi mở DAY → DAY đóng thì treo cổ rồi mở NIGHT
   * (lượt +1). Toàn bộ việc ĐỌC + GHI diễn ra trong CÙNG 1 transaction — "đánh dấu người
   * chết" và "chuyển pha/kết thúc ván" phải cùng thành công hoặc cùng rollback, nếu không
   * có thể xảy ra cảnh người đã chết thật trong DB nhưng ván vẫn đứng ở pha cũ vì chưa kịp
   * ghi pha mới. Xem docs/impl-phu-thuy.md §3.1, §3.2.
   *
   * Side effect NGOÀI DB (hẹn giờ trong RAM, phát sự kiện cho RoomsModule) cố ý để SAU KHI
   * transaction đã commit — không thực hiện những việc không thể rollback trong lúc giao
   * dịch còn có thể thất bại.
   */
  private async advanceGame(gameId: number): Promise<void> {
    const outcome = await this.dataSource.transaction(async (manager) => {
      const gamesRepo = manager.getRepository(Game);
      const playersRepo = manager.getRepository(GamePlayer);
      const votesRepo = manager.getRepository(GameVote);
      const actionsRepo = manager.getRepository(GameAction);

      const game = await gamesRepo.findOneBy({ id: gameId });
      if (!game || game.status !== GameStatus.IN_PROGRESS) return null;

      // Chốt chặn hẹn giờ bắn trùng: nếu phaseEndsAt còn ở tương lai nghĩa là một tick khác
      // đã xử lý xong pha này rồi (đã đẩy phaseEndsAt sang pha kế). Không làm gì để tránh
      // ván nhảy vọt một pha — xem docs/impl-phu-thuy.md §5.
      if (game.phaseEndsAt && game.phaseEndsAt.getTime() > Date.now()) {
        return null;
      }

      if (game.phase === GamePhase.NIGHT) {
        // Xét "còn Phù thuỷ sống" TRƯỚC khi áp dụng cái chết của đêm nay — nên nếu chính
        // Phù thuỷ là nạn nhân, pha SKILL vẫn mở và cô ấy vẫn kịp tự cứu.
        if (await this.hasAliveWitch(playersRepo, gameId)) {
          return this.advanceToPhase(gamesRepo, game, GamePhase.SKILL);
        }
        await this.resolveNightDeaths(
          votesRepo,
          playersRepo,
          actionsRepo,
          game,
        );
        const winner = await this.decideWinner(playersRepo, game);
        if (winner) return this.settleGame(gamesRepo, game, winner);
        return this.advanceToPhase(gamesRepo, game, GamePhase.DAY);
      }

      if (game.phase === GamePhase.SKILL) {
        await this.resolveNightDeaths(
          votesRepo,
          playersRepo,
          actionsRepo,
          game,
        );
        const winner = await this.decideWinner(playersRepo, game);
        if (winner) return this.settleGame(gamesRepo, game, winner);
        return this.advanceToPhase(gamesRepo, game, GamePhase.DAY);
      }

      // DAY
      await this.resolveDayLynch(votesRepo, playersRepo, game);
      const winner = await this.decideWinner(playersRepo, game);
      if (winner) return this.settleGame(gamesRepo, game, winner);
      game.dayNumber += 1;
      return this.advanceToPhase(gamesRepo, game, GamePhase.NIGHT);
    });

    if (!outcome) return; // ván không còn chạy, hoặc bị chặn bởi chốt bắn trùng

    if (outcome.type === 'finished') {
      this.cancelPhase(gameId);
      this.eventEmitter.emit('game.finished', { roomId: outcome.roomId });
    } else {
      this.schedulePhase(gameId, PHASE_DURATION_MS[outcome.phase]);
    }
  }

  /** Đổi phase, đặt lại phaseEndsAt theo đúng thời lượng của pha đó, rồi ghi trong transaction. */
  private async advanceToPhase(
    gamesRepo: Repository<Game>,
    game: Game,
    phase: GamePhase,
  ): Promise<AdvanceOutcome> {
    game.phase = phase;
    game.phaseEndsAt = new Date(Date.now() + PHASE_DURATION_MS[phase]);
    await gamesRepo.save(game);
    return { type: 'continued', phase };
  }

  /** Ghi ván đã kết thúc trong transaction. Sự kiện game.finished phát ở advanceGame(), SAU commit. */
  private async settleGame(
    gamesRepo: Repository<Game>,
    game: Game,
    winner: GameWinner,
  ): Promise<AdvanceOutcome> {
    await gamesRepo.update(game.id, {
      status: GameStatus.FINISHED,
      winner,
      finishedAt: new Date(),
      phaseEndsAt: null,
    });
    return { type: 'finished', roomId: game.roomId };
  }

  /**
   * Ván này có cần mở pha SKILL không — chỉ khi còn Phù thuỷ sống. KHÔNG được xét thêm
   * "còn thuốc hay không": bỏ pha vì hết thuốc là rò rỉ (lộ Phù thuỷ đã cạn cả 2 bình).
   * Xem docs/impl-phu-thuy.md §3.1.
   */
  private async hasAliveWitch(
    playersRepo: Repository<GamePlayer>,
    gameId: number,
  ): Promise<boolean> {
    const witch = await playersRepo.findOneBy({
      gameId,
      role: WITCH_ROLE,
      isAlive: true,
    });
    return witch !== null;
  }

  /**
   * Áp dụng toàn bộ cái chết của một đêm — Sói cắn (trừ Bảo vệ che, trừ thuốc cứu) và thuốc
   * độc (không ai chặn được), gộp vào MỘT TẬP rồi đánh dấu chết cùng lúc. Trả về danh sách
   * người vừa chết để nơi gọi xét thắng thua. Xem docs/impl-phu-thuy.md §3.2.
   */
  private async resolveNightDeaths(
    votesRepo: Repository<GameVote>,
    playersRepo: Repository<GamePlayer>,
    actionsRepo: Repository<GameAction>,
    game: Game,
  ): Promise<GamePlayer[]> {
    const deadByUserId = new Map<number, GamePlayer>();

    // Nguồn 1: Sói cắn — trừ Bảo vệ che và trừ thuốc cứu.
    const wolfVotes = await votesRepo.find({
      where: {
        gameId: game.id,
        phase: GamePhase.NIGHT,
        dayNumber: game.dayNumber,
      },
    });
    const victimId = this.pickUniqueMaxTarget(this.tallyByTarget(wolfVotes));
    if (victimId !== null) {
      const protectedByGuardian = await this.isProtected(
        actionsRepo,
        game,
        victimId,
      );
      // Chỉ cần hỏi "có bản ghi cứu đêm nay không" — phiếu Sói đã đóng băng nên mục tiêu
      // của bản ghi cứu (nếu có) luôn khớp với victimId, không cần so lại.
      const savedByWitch = await this.findActionOfType(
        actionsRepo,
        game.id,
        game.dayNumber,
        GameActionType.WITCH_HEAL,
      );
      if (!protectedByGuardian && !savedByWitch) {
        const victim = await playersRepo.findOneBy({
          gameId: game.id,
          userId: victimId,
        });
        if (victim) deadByUserId.set(victim.userId, victim);
      }
    }

    // Nguồn 2: thuốc độc — Bảo vệ KHÔNG chặn được, thuốc cứu KHÔNG cứu được.
    const poison = await this.findActionOfType(
      actionsRepo,
      game.id,
      game.dayNumber,
      GameActionType.WITCH_POISON,
    );
    if (poison) {
      const poisoned = await playersRepo.findOneBy({
        gameId: game.id,
        userId: poison.targetId,
      });
      if (poisoned) deadByUserId.set(poisoned.userId, poisoned);
    }

    const deaths = [...deadByUserId.values()];
    if (deaths.length > 0) {
      await playersRepo.update(
        { gameId: game.id, userId: In(deaths.map((d) => d.userId)) },
        { isAlive: false },
      );
    }
    return deaths;
  }

  /**
   * Treo cổ người bị vote nhiều nhất ở pha DAY. Không áp dụng che của Bảo vệ hay thuốc men
   * gì — cả hai chỉ có tác dụng ban đêm.
   */
  private async resolveDayLynch(
    votesRepo: Repository<GameVote>,
    playersRepo: Repository<GamePlayer>,
    game: Game,
  ): Promise<GamePlayer | null> {
    const votes = await votesRepo.find({
      where: {
        gameId: game.id,
        phase: GamePhase.DAY,
        dayNumber: game.dayNumber,
      },
    });
    const targetId = this.pickUniqueMaxTarget(this.tallyByTarget(votes));
    if (targetId === null) return null;

    const target = await playersRepo.findOneBy({
      gameId: game.id,
      userId: targetId,
    });
    if (!target) return null;

    target.isAlive = false;
    await playersRepo.save(target);
    return target;
  }

  /**
   * Xác định phe thắng theo docs/game-rules.md §5, dựa trên số người còn sống — KHÔNG có
   * side effect gì (không tự ghi DB), chỉ trả về quyết định để advanceGame() gọi
   * settleGame() nếu cần. Giai đoạn này chỉ có 2 phe nên không xét THIRD_PARTY.
   */
  private async decideWinner(
    playersRepo: Repository<GamePlayer>,
    game: Game,
  ): Promise<GameWinner | null> {
    const players = await playersRepo.find({
      where: { gameId: game.id },
    });
    const aliveWerewolves = players.filter(
      (p) => p.isAlive && WEREWOLF_ROLES.includes(p.role),
    ).length;
    const aliveVillagerSide = players.filter(
      (p) => p.isAlive && !WEREWOLF_ROLES.includes(p.role),
    ).length;

    if (aliveWerewolves === 0) return GameWinner.VILLAGER;
    if (aliveWerewolves >= aliveVillagerSide) return GameWinner.WEREWOLF;
    return null;
  }

  private buildShuffledRoles(maxPlayers: number): string[] {
    const roleConfig = ROLE_CONFIG_BY_MAX_PLAYERS[maxPlayers as MaxPlayers];
    const roles: string[] = [];
    for (const [role, count] of Object.entries(roleConfig)) {
      for (let i = 0; i < count; i++) roles.push(role);
    }

    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    return roles;
  }

  private tallyByTarget(votes: GameVote[]): Map<number, number> {
    const tally = new Map<number, number>();
    for (const vote of votes) {
      tally.set(vote.targetId, (tally.get(vote.targetId) ?? 0) + 1);
    }
    return tally;
  }

  /** Trả về targetId duy nhất có số phiếu cao nhất, hoặc null nếu hòa phiếu / không ai vote. */
  private pickUniqueMaxTarget(tally: Map<number, number>): number | null {
    let maxCount = 0;
    let maxTarget: number | null = null;
    let isTie = false;

    for (const [targetId, count] of tally) {
      if (count > maxCount) {
        maxCount = count;
        maxTarget = targetId;
        isTie = false;
      } else if (count === maxCount) {
        isTie = true;
      }
    }

    return maxCount > 0 && !isTie ? maxTarget : null;
  }

  private phaseTimerName(gameId: number): string {
    return `game-phase-${gameId}`;
  }

  /**
   * Hẹn giờ đóng pha hiện tại của một ván. Timer nằm trong RAM (SchedulerRegistry) nên
   * restart server là ván đứng — nợ kỹ thuật đã ghi ở PLAN.md §7.
   */
  private schedulePhase(gameId: number, durationMs: number): void {
    this.cancelPhase(gameId); // mỗi ván chỉ giữ đúng 1 timer
    const timeout = setTimeout(() => {
      this.cancelPhase(gameId); // dọn khỏi registry trước khi chạy
      this.advanceGame(gameId).catch((err) =>
        this.logger.error(
          `Lỗi khi tự động chuyển pha cho game #${gameId}`,
          err instanceof Error ? err.stack : undefined,
        ),
      );
    }, durationMs);
    this.schedulerRegistry.addTimeout(this.phaseTimerName(gameId), timeout);
  }

  private cancelPhase(gameId: number): void {
    const name = this.phaseTimerName(gameId);
    if (this.schedulerRegistry.doesExist('timeout', name)) {
      this.schedulerRegistry.deleteTimeout(name); // tự gọi clearTimeout bên trong
    }
  }
}
