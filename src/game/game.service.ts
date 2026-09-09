import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { SEER_ROLE, WEREWOLF_ROLES } from './constants/factions';
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

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
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
      // Tạo record game chơi
      const game = await this.gamesRepo.save(
        this.gamesRepo.create({
          roomId: payload.roomId,
          status: GameStatus.IN_PROGRESS,
          phase: GamePhase.NIGHT,
          dayNumber: 0,
          phaseEndsAt: new Date(Date.now() + PHASE_DURATION_MS),
        }),
      );

      const roles = this.buildShuffledRoles(payload.maxPlayers);
      const players = payload.memberIds.map((userId, i) =>
        this.playersRepo.create({
          gameId: game.id,
          userId,
          role: roles[i],
          isAlive: true,
        }),
      );
      await this.playersRepo.save(players);

      this.schedulePhase(game.id);
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
      const check = await this.findSeerCheck(gameId, game.dayNumber, userId);
      return {
        ...base,
        seer: {
          canCheckNow: this.canSeerCheckNow(game, me) && !check,
          checkedThisNight: check
            ? {
                targetUserId: check.targetId,
                isWerewolf: check.result === SeerCheckResult.WEREWOLF,
              }
            : null,
        },
      };
    }

    // Vai khác không có khoá `teammates` lẫn `seer` — kể cả rỗng, vì sự tồn tại của khoá
    // cũng đã là một tín hiệu rò rỉ.
    return base;
  }

  /** Bây giờ bấm bỏ phiếu có được không — cùng bộ điều kiện castVote() kiểm tra. */
  private canVoteNow(game: Game, me: GamePlayer): boolean {
    if (game.status !== GameStatus.IN_PROGRESS) return false;
    if (!me.isAlive) return false;
    if (game.phase === GamePhase.NIGHT && !WEREWOLF_ROLES.includes(me.role)) {
      return false;
    }
    return true;
  }

  /**
   * Tiên tri soi 1 người trong đêm hiện tại, biết người đó có phải Sói hay không.
   * Ghi một lần, KHÔNG sửa được — xem docs/role-tien-tri.md §2.
   */
  async seerCheck(gameId: number, actorId: number, targetUserId: number) {
    const game = await this.gamesRepo.findOneBy({ id: gameId });
    if (!game) throw new NotFoundException('Không tìm thấy ván chơi');
    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new ConflictException('Ván chơi đã kết thúc');
    }
    if (game.phase !== GamePhase.NIGHT) {
      throw new ConflictException(
        'Nhà tiên tri chỉ được dùng chức năng vào ban đêm',
      );
    }

    const actor = await this.playersRepo.findOneBy({ gameId, userId: actorId });
    if (!actor) throw new ForbiddenException('Bạn không thuộc ván chơi này');
    if (actor.role !== SEER_ROLE) {
      throw new ForbiddenException('Chỉ Tiên tri mới dùng được kỹ năng này');
    }
    if (!actor.isAlive) {
      throw new ForbiddenException('Bạn đã chết, không thể soi');
    }

    // Tầng chặn 1: hỏi trước cho thông báo dễ hiểu. Tầng 2 là ràng buộc UNIQUE bên dưới,
    // bịt khe hở giữa lúc kiểm tra và lúc ghi — xem docs/role-tien-tri.md §4.5.
    if (await this.findSeerCheck(gameId, game.dayNumber, actorId)) {
      throw new ConflictException('Đêm nay bạn đã dùng lượt kĩ năng rồi');
    }

    if (targetUserId === actorId) {
      throw new BadRequestException('Không thể tự soi chính mình');
    }

    const target = await this.playersRepo.findOneBy({
      gameId,
      userId: targetUserId,
    });
    if (!target) throw new NotFoundException('Người chơi không thuộc ván này');
    if (!target.isAlive) {
      throw new ConflictException('Không thể xem người đã chết');
    }

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

  private findSeerCheck(
    gameId: number,
    dayNumber: number,
    actorId: number,
  ): Promise<GameAction | null> {
    return this.actionsRepo.findOneBy({
      gameId,
      dayNumber,
      actionType: GameActionType.SEER_CHECK,
      actorId,
    });
  }

  /** Điều kiện soi KHÔNG tính chuyện "đêm nay đã soi chưa" — phần đó tra riêng. */
  private canSeerCheckNow(game: Game, me: GamePlayer): boolean {
    return (
      game.status === GameStatus.IN_PROGRESS &&
      game.phase === GamePhase.NIGHT &&
      me.isAlive
    );
  }

  private isUniqueViolation(err: unknown): boolean {
    return (err as { code?: string })?.code === '23505';
  }

  /**
   * Bỏ/đổi phiếu của người gọi request cho lượt hiện tại. Cả 2 pha đều mở cổng bỏ phiếu:
   * NIGHT chỉ Sói còn sống được vote (chọn nạn nhân), DAY mọi người còn sống được vote
   * (đề nghị treo cổ). Gọi lại nhiều lần trong cùng pha = đổi phiếu, không cộng dồn
   * (UNIQUE theo gameId+phase+dayNumber+voterId).
   */
  async castVote(gameId: number, voterId: number, targetUserId: number) {
    const game = await this.gamesRepo.findOneBy({ id: gameId });
    if (!game) throw new NotFoundException('Không tìm thấy ván chơi');
    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new ConflictException('Ván chơi đã kết thúc');
    }

    const voter = await this.playersRepo.findOneBy({ gameId, userId: voterId });
    if (!voter) throw new ForbiddenException('Bạn không thuộc ván chơi này');
    if (!voter.isAlive)
      throw new ForbiddenException('Bạn đã chết, không thể bỏ phiếu');
    if (
      game.phase === GamePhase.NIGHT &&
      !WEREWOLF_ROLES.includes(voter.role)
    ) {
      throw new ForbiddenException('Chỉ Sói được chọn nạn nhân ban đêm');
    }

    const target = await this.playersRepo.findOneBy({
      gameId,
      userId: targetUserId,
    });
    if (!target) throw new NotFoundException('Người chơi không thuộc ván này');
    if (!target.isAlive) {
      throw new ConflictException('Không thể bỏ phiếu cho người đã chết');
    }

    const existingVote = await this.votesRepo.findOneBy({
      gameId,
      phase: game.phase,
      dayNumber: game.dayNumber,
      voterId,
    });
    if (existingVote) {
      existingVote.targetId = targetUserId;
      await this.votesRepo.save(existingVote);
    } else {
      await this.votesRepo.save(
        this.votesRepo.create({
          gameId,
          phase: game.phase,
          dayNumber: game.dayNumber,
          voterId,
          targetId: targetUserId,
        }),
      );
    }

    return this.getVoteTally(gameId, voterId);
  }

  /**
   * Kiểm phiếu hiện tại của pha đang mở. NIGHT chỉ Sói xem được (bàn bạc kín), DAY ai còn
   * trong ván cũng xem được (bỏ phiếu công khai) — xem docs/game-rules.md.
   */
  async getVoteTally(gameId: number, requesterId: number) {
    const game = await this.gamesRepo.findOneBy({ id: gameId });
    if (!game) throw new NotFoundException('Không tìm thấy ván chơi');

    const requester = await this.playersRepo.findOneBy({
      gameId,
      userId: requesterId,
    });
    if (!requester)
      throw new ForbiddenException('Bạn không thuộc ván chơi này');

    if (
      game.phase === GamePhase.NIGHT &&
      !WEREWOLF_ROLES.includes(requester.role)
    ) {
      throw new ForbiddenException('Chỉ Ma Sói được xem phiếu ban đêm');
    }

    const votes = await this.votesRepo.find({
      where: { gameId, phase: game.phase, dayNumber: game.dayNumber },
    });

    const tally = this.tallyByTarget(votes);
    const myVote = votes.find((v) => v.voterId === requesterId);

    return {
      phase: game.phase,
      dayNumber: game.dayNumber,
      phaseEndsAt: game.phaseEndsAt,
      myVoteTargetId: myVote?.targetId ?? null,
      tally: [...tally.entries()]
        .map(([targetUserId, count]) => ({ targetUserId, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /**
   * Hết giờ một pha: kiểm phiếu của pha vừa đóng, giết người bị vote nhiều nhất, xét điều
   * kiện thắng rồi mở pha kế tiếp. NIGHT → DAY → NIGHT (lượt +1) → ...
   * Xem docs/game-rounds.md §5.
   */
  private async advanceGame(gameId: number): Promise<void> {
    const game = await this.gamesRepo.findOneBy({ id: gameId });
    if (!game || game.status !== GameStatus.IN_PROGRESS) return;

    await this.resolveVoteKill(game);
    if (await this.checkWinCondition(game)) return;

    if (game.phase === GamePhase.NIGHT) {
      game.phase = GamePhase.DAY;
    } else {
      game.phase = GamePhase.NIGHT;
      game.dayNumber += 1;
    }
    game.phaseEndsAt = new Date(Date.now() + PHASE_DURATION_MS);
    await this.gamesRepo.save(game);

    this.schedulePhase(game.id);
  }

  /**
   * Kiểm phiếu của pha đang mở và giết người bị vote nhiều nhất. Hòa phiếu hoặc không ai
   * bỏ phiếu thì không ai chết.
   */
  private async resolveVoteKill(game: Game): Promise<GamePlayer | null> {
    const votes = await this.votesRepo.find({
      where: { gameId: game.id, phase: game.phase, dayNumber: game.dayNumber },
    });
    const targetId = this.pickUniqueMaxTarget(this.tallyByTarget(votes));
    if (targetId === null) return null;

    const target = await this.playersRepo.findOneBy({
      gameId: game.id,
      userId: targetId,
    });
    if (!target) return null;

    target.isAlive = false;
    await this.playersRepo.save(target);
    return target;
  }

  /**
   * Điều kiện thắng theo docs/game-rules.md §5, dựa trên số người còn sống. Giai đoạn này
   * chỉ có 2 phe nên không xét THIRD_PARTY.
   */
  private async checkWinCondition(game: Game): Promise<boolean> {
    const players = await this.playersRepo.find({
      where: { gameId: game.id },
    });
    const aliveWerewolves = players.filter(
      (p) => p.isAlive && WEREWOLF_ROLES.includes(p.role),
    ).length;
    const aliveVillagerSide = players.filter(
      (p) => p.isAlive && !WEREWOLF_ROLES.includes(p.role),
    ).length;

    let winner: GameWinner | null = null;
    if (aliveWerewolves === 0) {
      winner = GameWinner.VILLAGER;
    } else if (aliveWerewolves >= aliveVillagerSide) {
      winner = GameWinner.WEREWOLF;
    }

    if (winner) {
      await this.finishGame(game.id, winner);
      return true;
    }
    return false;
  }

  private async finishGame(gameId: number, winner: GameWinner): Promise<void> {
    this.cancelPhase(gameId);
    await this.gamesRepo.update(gameId, {
      status: GameStatus.FINISHED,
      winner,
      finishedAt: new Date(),
      phaseEndsAt: null,
    });
    const game = await this.gamesRepo.findOneBy({ id: gameId });
    if (!game) return;
    this.eventEmitter.emit('game.finished', { roomId: game.roomId });
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
  private schedulePhase(gameId: number): void {
    this.cancelPhase(gameId); // mỗi ván chỉ giữ đúng 1 timer
    const timeout = setTimeout(() => {
      this.cancelPhase(gameId); // dọn khỏi registry trước khi chạy
      this.advanceGame(gameId).catch((err) =>
        this.logger.error(
          `Lỗi khi tự động chuyển pha cho game #${gameId}`,
          err instanceof Error ? err.stack : undefined,
        ),
      );
    }, PHASE_DURATION_MS);
    this.schedulerRegistry.addTimeout(this.phaseTimerName(gameId), timeout);
  }

  private cancelPhase(gameId: number): void {
    const name = this.phaseTimerName(gameId);
    if (this.schedulerRegistry.doesExist('timeout', name)) {
      this.schedulerRegistry.deleteTimeout(name); // tự gọi clearTimeout bên trong
    }
  }
}
