import { PlayerId } from '../value-objects/player-id.vo';
import { GamePhase } from '../enums/game-phase.enum';

// Phiếu bầu hiện tại của 1 người trong 1 lượt (gameId + phase + dayNumber). Đổi phiếu là
// changeTarget() trên chính dòng này, không tạo dòng mới — nên "vote nhiều lần" không bị tính
// nhiều lần khi kiểm phiếu.
export class GameVote {
  private constructor(
    readonly gameId: number,
    readonly phase: GamePhase,
    readonly dayNumber: number,
    readonly voterId: PlayerId,
    private _targetId: PlayerId,
  ) {}

  static cast(
    gameId: number,
    phase: GamePhase,
    dayNumber: number,
    voterId: PlayerId,
    targetId: PlayerId,
  ): GameVote {
    return new GameVote(gameId, phase, dayNumber, voterId, targetId);
  }

  static reconstitute(props: {
    gameId: number;
    phase: GamePhase;
    dayNumber: number;
    voterId: PlayerId;
    targetId: PlayerId;
  }): GameVote {
    return new GameVote(
      props.gameId,
      props.phase,
      props.dayNumber,
      props.voterId,
      props.targetId,
    );
  }

  get targetId(): PlayerId {
    return this._targetId;
  }

  changeTarget(newTarget: PlayerId): void {
    this._targetId = newTarget;
  }
}
