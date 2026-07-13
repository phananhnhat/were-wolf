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
import { WEREWOLF_ROLES } from './constants/factions';
import {
  ROLE_CONFIG_BY_MAX_PLAYERS,
  MaxPlayers,
} from '../rooms/constants/room-configs';

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
    await this.gamesRepo.update(
      { roomId: payload.roomId, status: GameStatus.IN_PROGRESS },
      { status: GameStatus.CANCELLED, finishedAt: new Date() },
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
   * Đứng thay chỗ cho rule engine đêm/ngày (chưa xây dựng) — mô phỏng 1 người chơi chết
   * để demo luồng tạo ván → đạt điều kiện thắng → kết thúc ván (xem docs/game.md).
   */
  async killPlayer(gameId: number, requesterId: number, targetUserId: number) {
    const game = await this.gamesRepo.findOneBy({ id: gameId });
    if (!game) throw new NotFoundException('Không tìm thấy ván chơi');
    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new ConflictException('Ván chơi đã kết thúc');
    }

    const requester = await this.playersRepo.findOneBy({
      gameId,
      userId: requesterId,
    });
    if (!requester) {
      throw new ForbiddenException('Bạn không thuộc ván chơi này');
    }

    const target = await this.playersRepo.findOneBy({
      gameId,
      userId: targetUserId,
    });
    if (!target) throw new NotFoundException('Người chơi không thuộc ván này');
    if (!target.isAlive) {
      throw new ConflictException('Người chơi đã chết trước đó');
    }

    target.isAlive = false;
    await this.playersRepo.save(target);

    await this.checkWinCondition(game);
    return target;
  }

  /**
   * Điều kiện thắng theo docs/game-rules.md §5 — chỉ tính 2 điều kiện dựa trên số người còn
   * sống (không phụ thuộc nguyên nhân chết). Điều kiện thắng của "Người điên" (bị treo cổ)
   * cần rule engine đêm/ngày nên chưa xử lý ở đây.
   */
  private async checkWinCondition(game: Game): Promise<void> {
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
    }
  }

  private async finishGame(gameId: number, winner: GameWinner): Promise<void> {
    await this.gamesRepo.update(gameId, {
      status: GameStatus.FINISHED,
      winner,
      finishedAt: new Date(),
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
}
