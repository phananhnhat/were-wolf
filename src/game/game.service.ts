import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  Game,
  GamePhase,
  GameStatus,
  GameWinner,
} from './entities/game.entity';
import { GamePlayer } from './entities/game-player.entity';
import { GameVote } from './entities/game-vote.entity';
import { WEREWOLF_ROLES, THIRD_PARTY_ROLES } from './constants/factions';
import {
  ROLE_CONFIG_BY_MAX_PLAYERS,
  MaxPlayers,
} from '../rooms/constants/room-configs';
import {
  NIGHT_DURATION_MS,
  DAY_DISCUSSION_DURATION_MS,
  DAY_VOTE_DURATION_MS,
} from './constants/timing';

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

  // Timer của pha đang chạy cho mỗi ván, key = gameId. Chỉ tồn tại trong bộ nhớ process —
  // nếu server restart thì ván đang chơi sẽ không tự chuyển pha nữa (chấp nhận được ở giai
  // đoạn chưa có realtime/queue, xem docs/game.md).
  private readonly phaseTimers = new Map<number, NodeJS.Timeout>();

  constructor(
    @InjectRepository(Game)
    private readonly gamesRepo: Repository<Game>,
    @InjectRepository(GamePlayer)
    private readonly playersRepo: Repository<GamePlayer>,
    @InjectRepository(GameVote)
    private readonly votesRepo: Repository<GameVote>,
    private readonly eventEmitter: EventEmitter2,
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
      const game = await this.gamesRepo.save(
        this.gamesRepo.create({
          roomId: payload.roomId,
          status: GameStatus.IN_PROGRESS,
          phase: GamePhase.NIGHT,
          dayNumber: 0,
          phaseEndsAt: new Date(Date.now() + NIGHT_DURATION_MS),
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

      this.scheduleTimer(game.id, NIGHT_DURATION_MS, () =>
        this.resolveNightPhase(game.id),
      );
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
      this.clearTimer(game.id);
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

  async getGameStateForUser(roomId: number, userId: number) {
    const game = await this.gamesRepo.findOne({
      where: { roomId },
      order: { startedAt: 'DESC' },
    });
    if (!game) throw new NotFoundException('Phòng chưa có ván chơi nào');

    const players = await this.playersRepo.find({
      where: { gameId: game.id },
    });
    const me = players.find((p) => p.userId === userId);
    if (!me) throw new ForbiddenException('Bạn không thuộc ván chơi này');

    const isFinished = game.status !== GameStatus.IN_PROGRESS;
    const iAmWerewolf = WEREWOLF_ROLES.includes(me.role);

    return {
      id: game.id,
      status: game.status,
      phase: game.phase,
      dayNumber: game.dayNumber,
      phaseEndsAt: game.phaseEndsAt,
      winner: game.winner,
      myRole: me.role,
      players: players.map((p) => ({
        userId: p.userId,
        isAlive: p.isAlive,
        role: this.revealRoleIfAllowed(p, isFinished, iAmWerewolf),
      })),
    };
  }

  /**
   * Bỏ/đổi phiếu của người gọi request cho lượt hiện tại. NIGHT chỉ Sói còn sống được vote
   * (chọn nạn nhân), DAY_VOTE mọi người còn sống được vote (đề nghị treo cổ). Gọi lại nhiều
   * lần trong cùng lượt = đổi phiếu, không cộng dồn (UNIQUE theo gameId+phase+dayNumber+voterId).
   */
  async castVote(gameId: number, voterId: number, targetUserId: number) {
    const game = await this.gamesRepo.findOneBy({ id: gameId });
    if (!game) throw new NotFoundException('Không tìm thấy ván chơi');
    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new ConflictException('Ván chơi đã kết thúc');
    }
    if (game.phase !== GamePhase.NIGHT && game.phase !== GamePhase.DAY_VOTE) {
      throw new ConflictException('Chưa tới giờ bỏ phiếu');
    }

    const voter = await this.playersRepo.findOneBy({ gameId, userId: voterId });
    if (!voter) throw new ForbiddenException('Bạn không thuộc ván chơi này');
    if (!voter.isAlive)
      throw new ForbiddenException('Bạn đã chết, không thể bỏ phiếu');
    if (
      game.phase === GamePhase.NIGHT &&
      !WEREWOLF_ROLES.includes(voter.role)
    ) {
      throw new ForbiddenException('Chỉ Ma Sói được chọn nạn nhân ban đêm');
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
   * Kiểm phiếu hiện tại của lượt đang mở. NIGHT chỉ Sói còn sống xem được (bàn bạc kín),
   * DAY_VOTE ai còn trong ván cũng xem được (bỏ phiếu công khai) — xem docs/game-rules.md.
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
    if (game.phase === GamePhase.DAY) {
      throw new ConflictException('Chưa tới giờ bỏ phiếu');
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
   * Hết giờ NIGHT: kiểm phiếu Sói, nếu có 1 người bị vote nhiều nhất (không hòa) thì cắn
   * chết người đó (không công khai nguyên nhân — chỉ đánh dấu isAlive=false). Xem docs/game-rules.md §4-5.
   */
  private async resolveNightPhase(gameId: number): Promise<void> {
    const game = await this.gamesRepo.findOneBy({ id: gameId });
    if (
      !game ||
      game.status !== GameStatus.IN_PROGRESS ||
      game.phase !== GamePhase.NIGHT
    ) {
      return;
    }

    const votes = await this.votesRepo.find({
      where: { gameId, phase: GamePhase.NIGHT, dayNumber: game.dayNumber },
    });
    const target = this.pickUniqueMaxTarget(this.tallyByTarget(votes));
    if (target !== null) {
      await this.playersRepo.update(
        { gameId, userId: target },
        { isAlive: false },
      );
    }

    const finished = await this.checkWinCondition(game);
    if (finished) return;

    game.phase = GamePhase.DAY;
    game.phaseEndsAt = new Date(Date.now() + DAY_DISCUSSION_DURATION_MS);
    await this.gamesRepo.save(game);

    this.scheduleTimer(game.id, DAY_DISCUSSION_DURATION_MS, () =>
      this.startDayVote(game.id),
    );
  }

  /** Hết giờ thảo luận DAY: mở cửa bỏ phiếu treo cổ trong 1 phút. */
  private async startDayVote(gameId: number): Promise<void> {
    const game = await this.gamesRepo.findOneBy({ id: gameId });
    if (
      !game ||
      game.status !== GameStatus.IN_PROGRESS ||
      game.phase !== GamePhase.DAY
    ) {
      return;
    }

    game.phase = GamePhase.DAY_VOTE;
    game.phaseEndsAt = new Date(Date.now() + DAY_VOTE_DURATION_MS);
    await this.gamesRepo.save(game);

    this.scheduleTimer(game.id, DAY_VOTE_DURATION_MS, () =>
      this.resolveDayPhase(game.id),
    );
  }

  /**
   * Hết giờ DAY_VOTE: kiểm phiếu cả làng, nếu có 1 người bị vote nhiều nhất (không hòa) thì
   * treo cổ người đó. Người điên bị treo cổ thắng ngay (phe thứ ba) — xem docs/game-rules.md §5.
   */
  private async resolveDayPhase(gameId: number): Promise<void> {
    const game = await this.gamesRepo.findOneBy({ id: gameId });
    if (
      !game ||
      game.status !== GameStatus.IN_PROGRESS ||
      game.phase !== GamePhase.DAY_VOTE
    ) {
      return;
    }

    const votes = await this.votesRepo.find({
      where: { gameId, phase: GamePhase.DAY_VOTE, dayNumber: game.dayNumber },
    });
    const targetUserId = this.pickUniqueMaxTarget(this.tallyByTarget(votes));

    let lynched: GamePlayer | null = null;
    if (targetUserId !== null) {
      lynched = await this.playersRepo.findOneBy({
        gameId,
        userId: targetUserId,
      });
      if (lynched) {
        lynched.isAlive = false;
        await this.playersRepo.save(lynched);
      }
    }

    if (lynched && THIRD_PARTY_ROLES.includes(lynched.role)) {
      await this.finishGame(game.id, GameWinner.THIRD_PARTY);
      return;
    }

    const finished = await this.checkWinCondition(game);
    if (finished) return;

    game.dayNumber += 1;
    game.phase = GamePhase.NIGHT;
    game.phaseEndsAt = new Date(Date.now() + NIGHT_DURATION_MS);
    await this.gamesRepo.save(game);

    this.scheduleTimer(game.id, NIGHT_DURATION_MS, () =>
      this.resolveNightPhase(game.id),
    );
  }

  /**
   * Điều kiện thắng theo docs/game-rules.md §5, dựa trên số người còn sống (không phụ thuộc
   * nguyên nhân chết). Điều kiện thắng riêng của "Người điên" xử lý ở resolveDayPhase().
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
    this.clearTimer(gameId);
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

  private revealRoleIfAllowed(
    player: GamePlayer,
    isFinished: boolean,
    iAmWerewolf: boolean,
  ): string | undefined {
    const canReveal =
      !player.isAlive ||
      isFinished ||
      (iAmWerewolf && WEREWOLF_ROLES.includes(player.role));
    return canReveal ? player.role : undefined;
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

  private scheduleTimer(
    gameId: number,
    delayMs: number,
    handler: () => Promise<void>,
  ): void {
    this.clearTimer(gameId);
    const timeout = setTimeout(() => {
      this.phaseTimers.delete(gameId);
      handler().catch((err) =>
        this.logger.error(
          `Lỗi khi tự động chuyển pha cho game #${gameId}`,
          err instanceof Error ? err.stack : undefined,
        ),
      );
    }, delayMs);
    this.phaseTimers.set(gameId, timeout);
  }

  private clearTimer(gameId: number): void {
    const existing = this.phaseTimers.get(gameId);
    if (existing) {
      clearTimeout(existing);
      this.phaseTimers.delete(gameId);
    }
  }
}
