import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { ROOM_REPOSITORY } from './domain/repositories/room.repository';
import type { RoomRepository } from './domain/repositories/room.repository';
import { ROOM_MEMBER_REPOSITORY } from './domain/repositories/room-member.repository';
import type { RoomMemberRepository } from './domain/repositories/room-member.repository';
import { ROOM_UNIT_OF_WORK } from './application/ports/room-unit-of-work';
import type { RoomUnitOfWork } from './application/ports/room-unit-of-work';
import { ROOM_EVENT_PUBLISHER } from './application/ports/room-event-publisher';
import type { RoomEventPublisher } from './application/ports/room-event-publisher';
import { GAME_STATUS_READER } from './application/ports/game-status-reader';
import type { GameStatusReader } from './application/ports/game-status-reader';
import { ROOM_LOGGER } from './application/ports/logger';
import type { Logger } from './application/ports/logger';
import type { Room } from './domain/entities/room.entity';
import type { RoomStatus } from './domain/enums/room-status.enum';
import type { RoomDetailOutput } from './application/use-cases/find-room-detail.use-case';

import { findWaitingRooms } from './application/use-cases/find-waiting-rooms.use-case';
import { findMyRoom } from './application/use-cases/find-my-room.use-case';
import { findRoomDetail } from './application/use-cases/find-room-detail.use-case';
import { createRoom } from './application/use-cases/create-room.use-case';
import { joinRoom } from './application/use-cases/join-room.use-case';
import { leaveRoom } from './application/use-cases/leave-room.use-case';
import { startGame } from './application/use-cases/start-game.use-case';
import { finishGame } from './application/use-cases/finish-game.use-case';
import { removeRoom } from './application/use-cases/remove-room.use-case';
import { handleGameStartFailed } from './application/use-cases/handle-game-start-failed.use-case';
import { reconcileStuckRooms } from './application/use-cases/reconcile-stuck-rooms.use-case';

import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';

const RECONCILE_INTERVAL_MS = 30_000;

export interface RoomResponseDto {
  id: number;
  code: string;
  hostId: number;
  status: RoomStatus;
  maxPlayers: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomMemberResponseDto {
  id: number;
  roomId: number;
  userId: number;
  isHost: boolean;
  joinedAt: Date;
  user: {
    id: number;
    name: string;
    username: string;
    email: string;
    address: string | null;
    gender: string | null;
    createdAt: Date;
  };
}

export interface RoomDetailResponseDto extends RoomResponseDto {
  members: RoomMemberResponseDto[];
}

// Facade (Interface Adapter) — nơi RoomsController và RoomsModule (qua @OnEvent/@Interval) gọi
// vào. Ánh xạ domain Room (VO cho code, không phải string thường) sang RoomResponseDto trước
// khi trả ra HTTP — Presenter, giống UsersService.
@Injectable()
export class RoomsService {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(ROOM_MEMBER_REPOSITORY)
    private readonly members: RoomMemberRepository,
    @Inject(ROOM_UNIT_OF_WORK) private readonly unitOfWork: RoomUnitOfWork,
    @Inject(ROOM_EVENT_PUBLISHER)
    private readonly eventPublisher: RoomEventPublisher,
    @Inject(GAME_STATUS_READER)
    private readonly gameStatusReader: GameStatusReader,
    @Inject(ROOM_LOGGER) private readonly logger: Logger,
  ) {}

  @OnEvent('game.finished')
  async handleGameFinished(payload: { roomId: number }): Promise<void> {
    await finishGame(this.rooms, payload.roomId);
  }

  @OnEvent('game.start_failed')
  handleGameStartFailed(payload: { roomId: number }): Promise<void> {
    return handleGameStartFailed(this.rooms, payload.roomId);
  }

  @Interval(RECONCILE_INTERVAL_MS)
  reconcileStuckRooms(): Promise<void> {
    return reconcileStuckRooms(this.rooms, this.gameStatusReader, this.logger);
  }

  async findWaitingRooms(page?: number, limit?: number) {
    const result = await findWaitingRooms(this.rooms, page, limit);
    return {
      items: result.items.map((r) => this.toResponse(r)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async findMyRoom(
    userId: number,
  ): Promise<{ room: RoomDetailResponseDto | null }> {
    const { room } = await findMyRoom(this.rooms, this.members, userId);
    return { room: room ? this.toDetailResponse(room) : null };
  }

  async findRoomDetail(
    roomId: number,
    userId: number,
  ): Promise<RoomDetailResponseDto> {
    const detail = await findRoomDetail(
      this.rooms,
      this.members,
      roomId,
      userId,
    );
    return this.toDetailResponse(detail);
  }

  async createRoom(
    userId: number,
    dto: CreateRoomDto,
  ): Promise<RoomResponseDto> {
    const room = await createRoom(this.unitOfWork, userId, dto.maxPlayers);
    return this.toResponse(room);
  }

  async joinRoom(userId: number, dto: JoinRoomDto): Promise<RoomResponseDto> {
    const room = await joinRoom(this.unitOfWork, userId, dto.code);
    return this.toResponse(room);
  }

  leaveRoom(userId: number, roomId: number) {
    return leaveRoom(this.rooms, this.members, userId, roomId);
  }

  async startGame(userId: number, roomId: number): Promise<RoomResponseDto> {
    const room = await startGame(
      this.rooms,
      this.members,
      this.eventPublisher,
      userId,
      roomId,
    );
    return this.toResponse(room);
  }

  removeRoom(userId: number, roomId: number) {
    return removeRoom(this.rooms, this.eventPublisher, userId, roomId);
  }

  private toResponse(room: Room): RoomResponseDto {
    return {
      id: room.id.toNumber(),
      code: room.code.toString(),
      hostId: room.hostId,
      status: room.status,
      maxPlayers: room.maxPlayers,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  private toDetailResponse(detail: RoomDetailOutput): RoomDetailResponseDto {
    return {
      ...this.toResponse(detail.room),
      members: detail.members.map((m) => ({
        id: m.id,
        roomId: m.roomId,
        userId: m.userId,
        isHost: m.isHost,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
    };
  }
}
