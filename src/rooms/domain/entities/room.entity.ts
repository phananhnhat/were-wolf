import { RoomId } from '../value-objects/room-id.vo';
import { RoomCode } from '../value-objects/room-code.vo';
import { RoomStatus } from '../enums/room-status.enum';
import { RoomNotWaitingError } from '../errors/room-not-waiting.error';
import { RoomIsPlayingError } from '../errors/room-is-playing.error';

// Aggregate root của một phòng chờ. RoomMember KHÔNG nằm trong aggregate này (giống GamePlayer
// không nằm trong Game) — là entity riêng, truy vấn qua RoomMemberRepository.
export class Room {
  private _id: RoomId | null;

  private constructor(
    id: RoomId | null,
    private _code: RoomCode,
    private _hostId: number,
    private _status: RoomStatus,
    readonly maxPlayers: number,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {
    this._id = id;
  }

  static create(hostId: number, code: RoomCode, maxPlayers: number): Room {
    const now = new Date();
    return new Room(
      null,
      code,
      hostId,
      RoomStatus.WAITING,
      maxPlayers,
      now,
      now,
    );
  }

  static reconstitute(props: {
    id: RoomId;
    code: RoomCode;
    hostId: number;
    status: RoomStatus;
    maxPlayers: number;
    createdAt: Date;
    updatedAt: Date;
  }): Room {
    return new Room(
      props.id,
      props.code,
      props.hostId,
      props.status,
      props.maxPlayers,
      props.createdAt,
      props.updatedAt,
    );
  }

  get id(): RoomId {
    if (!this._id) throw new Error('Room chưa được lưu nên chưa có id');
    return this._id;
  }

  assignId(id: RoomId): void {
    if (this._id) throw new Error('Room đã có id, không gán lại được');
    this._id = id;
  }

  hasId(): boolean {
    return this._id !== null;
  }

  get code(): RoomCode {
    return this._code;
  }

  get hostId(): number {
    return this._hostId;
  }

  get status(): RoomStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  isWaiting(): boolean {
    return this._status === RoomStatus.WAITING;
  }

  isPlaying(): boolean {
    return this._status === RoomStatus.PLAYING;
  }

  isHost(userId: number): boolean {
    return this._hostId === userId;
  }

  // `context` chỉ quyết định thông điệp lỗi (vào phòng hay bắt đầu ván) — luật thì như nhau.
  assertWaiting(context: 'join' | 'start'): void {
    if (!this.isWaiting()) {
      throw context === 'join'
        ? RoomNotWaitingError.forJoin()
        : RoomNotWaitingError.forStart();
    }
  }

  assertNotPlaying(): void {
    if (this.isPlaying()) {
      throw new RoomIsPlayingError();
    }
  }

  start(): void {
    this._status = RoomStatus.PLAYING;
    this._updatedAt = new Date();
  }

  finish(): void {
    this._status = RoomStatus.WAITING;
    this._updatedAt = new Date();
  }

  transferHost(newHostId: number): void {
    this._hostId = newHostId;
    this._updatedAt = new Date();
  }
}
