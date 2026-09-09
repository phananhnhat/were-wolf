import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Room, RoomStatus } from './entities/room.entity';
import { RoomMember } from './entities/room-member.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';

// Bảng chữ sinh mã phòng — bỏ ký tự dễ nhầm: 0/O, 1/I
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 5;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

@Injectable()
export class RoomsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Room)
    private readonly roomsRepo: Repository<Room>,
    @InjectRepository(RoomMember)
    private readonly membersRepo: Repository<RoomMember>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findWaitingRooms(page = DEFAULT_PAGE, limit = DEFAULT_LIMIT) {
    const currentPage =
      Number.isInteger(page) && page > 0 ? page : DEFAULT_PAGE;
    const pageSize =
      Number.isInteger(limit) && limit > 0
        ? Math.min(limit, MAX_LIMIT)
        : DEFAULT_LIMIT;

    const [items, total] = await this.roomsRepo.findAndCount({
      where: { status: RoomStatus.WAITING },
      order: { createdAt: 'DESC' },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    });

    return {
      items,
      total,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Phòng mà user đang ở, hoặc null nếu không ở phòng nào. Dùng để khôi phục trạng thái sau
   * khi client tải lại trang — lúc đó client không còn nhớ roomId nào cả.
   *
   * Luôn trả tối đa 1 phòng: cả createRoom() lẫn joinRoom() đều chặn user đang ở phòng khác,
   * nên mỗi user chỉ thuộc đúng một phòng tại một thời điểm.
   */
  async findMyRoom(userId: number) {
    const member = await this.membersRepo.findOneBy({ userId });
    if (!member) return { room: null };
    return { room: await this.findRoomDetail(member.roomId, userId) };
  }

  async findRoomDetail(roomId: number, userId: number) {
    const room = await this.roomsRepo.findOneBy({ id: roomId });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');

    const members = await this.membersRepo.find({
      where: { roomId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });
    if (!members.some((m) => m.userId === userId)) {
      throw new ForbiddenException('Bạn không phải thành viên của phòng này');
    }

    return { ...room, members };
  }

  async createRoom(userId: number, dto: CreateRoomDto) {
    return this.dataSource.transaction(async (manager) => {
      const roomRepo = manager.getRepository(Room);
      const memberRepo = manager.getRepository(RoomMember);

      if (await memberRepo.findOneBy({ userId })) {
        throw new ConflictException('Bạn đang ở trong một phòng khác');
      }

      const room = await this.saveRoomWithUniqueCode(
        roomRepo,
        userId,
        dto.maxPlayers,
      );
      await memberRepo.save(
        memberRepo.create({ roomId: room.id, userId, isHost: true }),
      );

      return room;
    });
  }

  async joinRoom(userId: number, dto: JoinRoomDto) {
    const code = dto.code.toUpperCase();

    return this.dataSource.transaction(async (manager) => {
      const roomRepo = manager.getRepository(Room);
      const memberRepo = manager.getRepository(RoomMember);

      const room = await roomRepo.findOne({
        where: { code },
        lock: { mode: 'pessimistic_write' },
      });
      if (!room) throw new NotFoundException('Không tìm thấy phòng');
      if (room.status !== RoomStatus.WAITING) {
        throw new ConflictException('Ván đang diễn ra, không thể vào');
      }

      if (await memberRepo.findOneBy({ userId })) {
        throw new ConflictException('Bạn đang ở trong một phòng khác');
      }

      const memberCount = await memberRepo.count({
        where: { roomId: room.id },
      });
      if (memberCount >= room.maxPlayers) {
        throw new ConflictException('Phòng đã đủ người');
      }

      await memberRepo.save(
        memberRepo.create({ roomId: room.id, userId, isHost: false }),
      );
      return room;
    });
  }

  async leaveRoom(userId: number, roomId: number) {
    const room = await this.roomsRepo.findOneBy({ id: roomId });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');
    if (room.status === RoomStatus.PLAYING) {
      throw new ConflictException('Ván đang diễn ra, không thể rời phòng');
    }

    const member = await this.membersRepo.findOneBy({ roomId, userId });
    if (!member) throw new NotFoundException('Bạn không ở trong phòng này');

    await this.membersRepo.remove(member);

    if (!member.isHost) {
      return { message: 'Đã rời phòng' };
    }

    const remaining = await this.membersRepo.find({
      where: { roomId },
      order: { joinedAt: 'ASC' },
    });

    if (remaining.length === 0) {
      await this.roomsRepo.delete(roomId);
      return { message: 'Phòng đã bị xóa vì không còn ai' };
    }

    const newHost = remaining[0];
    newHost.isHost = true;
    await this.membersRepo.save(newHost);
    room.hostId = newHost.userId;
    await this.roomsRepo.save(room);
    return { message: 'Đã rời phòng, quyền chủ phòng được chuyển' };
  }

  async startGame(userId: number, roomId: number) {
    const room = await this.roomsRepo.findOneBy({ id: roomId });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');
    if (room.hostId !== userId) {
      throw new ForbiddenException('Chỉ chủ phòng mới được bắt đầu ván');
    }
    if (room.status !== RoomStatus.WAITING) {
      throw new ConflictException('Phòng không ở trạng thái chờ');
    }

    const members = await this.membersRepo.find({ where: { roomId } });
    if (members.length !== room.maxPlayers) {
      throw new BadRequestException(
        `Cần đủ ${room.maxPlayers} người để bắt đầu`,
      );
    }

    room.status = RoomStatus.PLAYING;
    await this.roomsRepo.save(room);

    // GameModule lắng nghe event này để tạo ván + chia vai — không import trực tiếp
    // để tránh circular dependency, xem docs/game.md §2.
    this.eventEmitter.emit('room.started', {
      roomId: room.id,
      maxPlayers: room.maxPlayers,
      memberIds: members.map((m) => m.userId),
    });

    return room;
  }

  /**
   * Gọi nội bộ bởi GameModule khi ván kết thúc — không expose qua HTTP.
   */
  async finishGame(roomId: number): Promise<Room> {
    const room = await this.roomsRepo.findOneBy({ id: roomId });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');
    room.status = RoomStatus.WAITING;
    return this.roomsRepo.save(room);
  }

  async removeRoom(userId: number, roomId: number) {
    const room = await this.roomsRepo.findOneBy({ id: roomId });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');
    if (room.hostId !== userId) {
      throw new ForbiddenException('Chỉ chủ phòng mới được xóa phòng');
    }

    await this.roomsRepo.remove(room); // cascade xóa room_members
    // GameModule lắng nghe để huỷ (CANCELLED) ván đang chạy của phòng này, nếu có
    this.eventEmitter.emit('room.deleted', { roomId });
    return { message: 'Đã xóa phòng' };
  }

  @OnEvent('game.finished')
  async handleGameFinished(payload: { roomId: number }): Promise<void> {
    await this.finishGame(payload.roomId);
  }

  @OnEvent('game.start_failed')
  async handleGameStartFailed(payload: { roomId: number }): Promise<void> {
    const room = await this.roomsRepo.findOneBy({ id: payload.roomId });
    if (room && room.status === RoomStatus.PLAYING) {
      room.status = RoomStatus.WAITING;
      await this.roomsRepo.save(room);
    }
  }

  private async saveRoomWithUniqueCode(
    roomRepo: Repository<Room>,
    hostId: number,
    maxPlayers: number,
    attempt = 0,
  ): Promise<Room> {
    if (attempt >= MAX_CODE_ATTEMPTS) {
      throw new InternalServerErrorException(
        'Không thể tạo mã phòng, vui lòng thử lại',
      );
    }

    const code = this.generateCode();
    try {
      return await roomRepo.save(
        roomRepo.create({
          code,
          hostId,
          maxPlayers,
          status: RoomStatus.WAITING,
        }),
      );
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        return this.saveRoomWithUniqueCode(
          roomRepo,
          hostId,
          maxPlayers,
          attempt + 1,
        );
      }
      throw err;
    }
  }

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
  }

  private isUniqueViolation(err: unknown): boolean {
    return (err as { code?: string })?.code === '23505';
  }
}
