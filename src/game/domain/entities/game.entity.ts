import { GameId } from '../value-objects/game-id.vo';
import { GameStatus } from '../enums/game-status.enum';
import { GamePhase } from '../enums/game-phase.enum';
import { GameWinner } from '../enums/game-winner.enum';
import { GameNotInProgressError } from '../errors/game-not-in-progress.error';
import { WrongPhaseError } from '../errors/wrong-phase.error';

// Aggregate root của một ván chơi. Mang các invariant hiện đang bị lặp lại ở gần như mọi
// method của GameService cũ (`game.status !== IN_PROGRESS`, `game.phase !== requiredPhase`) —
// gom về đây để nơi gọi chỉ cần game.assertInProgress()/game.assertPhase(...).
export class Game {
  private _id: GameId | null;

  private constructor(
    id: GameId | null,
    readonly roomId: number,
    private _status: GameStatus,
    private _phase: GamePhase,
    private _dayNumber: number,
    private _phaseEndsAt: Date | null,
    private _winner: GameWinner | null,
    readonly startedAt: Date,
    private _finishedAt: Date | null,
  ) {
    this._id = id;
  }

  // Ván mới, chưa được lưu nên chưa có id — repository gán id qua assignId() sau khi insert.
  // Ván luôn mở màn bằng pha ban đêm của lượt 1 — xem docs/PLAN.md §5.1.
  static start(
    roomId: number,
    nightEndsAt: Date,
    startedAt: Date = new Date(),
  ): Game {
    return new Game(
      null,
      roomId,
      GameStatus.IN_PROGRESS,
      GamePhase.NIGHT,
      0,
      nightEndsAt,
      null,
      startedAt,
      null,
    );
  }

  static reconstitute(props: {
    id: GameId;
    roomId: number;
    status: GameStatus;
    phase: GamePhase;
    dayNumber: number;
    phaseEndsAt: Date | null;
    winner: GameWinner | null;
    startedAt: Date;
    finishedAt: Date | null;
  }): Game {
    return new Game(
      props.id,
      props.roomId,
      props.status,
      props.phase,
      props.dayNumber,
      props.phaseEndsAt,
      props.winner,
      props.startedAt,
      props.finishedAt,
    );
  }

  get id(): GameId {
    if (!this._id) {
      throw new Error('Game chưa được lưu nên chưa có id');
    }
    return this._id;
  }

  assignId(id: GameId): void {
    if (this._id) {
      throw new Error('Game đã có id, không gán lại được');
    }
    this._id = id;
  }

  // Không throw, khác getter `id` ở trên — dùng để repository biết insert (chưa có id) hay
  // update (đã có id) mà không cần try/catch.
  hasId(): boolean {
    return this._id !== null;
  }

  get status(): GameStatus {
    return this._status;
  }

  get phase(): GamePhase {
    return this._phase;
  }

  get dayNumber(): number {
    return this._dayNumber;
  }

  get phaseEndsAt(): Date | null {
    return this._phaseEndsAt;
  }

  get winner(): GameWinner | null {
    return this._winner;
  }

  get finishedAt(): Date | null {
    return this._finishedAt;
  }

  isInProgress(): boolean {
    return this._status === GameStatus.IN_PROGRESS;
  }

  isPhase(phase: GamePhase): boolean {
    return this._phase === phase;
  }

  assertInProgress(): void {
    if (!this.isInProgress()) {
      throw new GameNotInProgressError();
    }
  }

  // `context` chỉ quyết định thông điệp lỗi (dùng kỹ năng hay bỏ phiếu) — luật thì như nhau.
  assertPhase(required: GamePhase, context: 'skill' | 'vote'): void {
    if (this._phase !== required) {
      throw context === 'skill'
        ? WrongPhaseError.forSkill()
        : WrongPhaseError.forVote();
    }
  }

  advanceToPhase(phase: GamePhase, endsAt: Date): void {
    this._phase = phase;
    this._phaseEndsAt = endsAt;
  }

  incrementDay(): void {
    this._dayNumber += 1;
  }

  finish(winner: GameWinner, finishedAt: Date = new Date()): void {
    this._status = GameStatus.FINISHED;
    this._winner = winner;
    this._phaseEndsAt = null;
    this._finishedAt = finishedAt;
  }

  // Chủ phòng xoá phòng giữa ván — không có phe thắng. Xem docs/PLAN.md §5.1.
  cancel(finishedAt: Date = new Date()): void {
    this._status = GameStatus.CANCELLED;
    this._phaseEndsAt = null;
    this._finishedAt = finishedAt;
  }
}
