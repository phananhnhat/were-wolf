import { PlayerId } from '../value-objects/player-id.vo';
import { Role } from '../value-objects/role.vo';
import { Faction } from '../enums/faction.enum';

// Một người chơi trong một ván cụ thể — vai và trạng thái sống/chết cố định trong ngữ cảnh
// ván đó. Không phải aggregate root: chỉ có ý nghĩa gắn với một Game.
export class GamePlayer {
  private constructor(
    readonly gameId: number,
    readonly userId: PlayerId,
    readonly role: Role,
    private _isAlive: boolean,
  ) {}

  static reconstitute(props: {
    gameId: number;
    userId: PlayerId;
    role: Role;
    isAlive: boolean;
  }): GamePlayer {
    return new GamePlayer(
      props.gameId,
      props.userId,
      props.role,
      props.isAlive,
    );
  }

  static assignNew(gameId: number, userId: PlayerId, role: Role): GamePlayer {
    return new GamePlayer(gameId, userId, role, true);
  }

  get isAlive(): boolean {
    return this._isAlive;
  }

  kill(): void {
    this._isAlive = false;
  }

  isWerewolf(): boolean {
    return this.role.isWerewolf();
  }

  belongsToFaction(faction: Faction): boolean {
    return this.role.faction() === faction;
  }

  isOwnedBy(userId: PlayerId): boolean {
    return this.userId.equals(userId);
  }
}
