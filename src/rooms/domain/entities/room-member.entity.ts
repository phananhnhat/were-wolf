// Không giữ id tự tăng của Postgres — định danh bằng khoá tự nhiên (roomId, userId), giống
// GamePlayer ở GameModule không giữ id riêng.
export class RoomMember {
  private constructor(
    readonly roomId: number,
    readonly userId: number,
    private _isHost: boolean,
    readonly joinedAt: Date,
  ) {}

  static join(roomId: number, userId: number, isHost: boolean): RoomMember {
    return new RoomMember(roomId, userId, isHost, new Date());
  }

  static reconstitute(props: {
    roomId: number;
    userId: number;
    isHost: boolean;
    joinedAt: Date;
  }): RoomMember {
    return new RoomMember(
      props.roomId,
      props.userId,
      props.isHost,
      props.joinedAt,
    );
  }

  get isHost(): boolean {
    return this._isHost;
  }

  promoteToHost(): void {
    this._isHost = true;
  }

  isOwnedBy(userId: number): boolean {
    return this.userId === userId;
  }
}
