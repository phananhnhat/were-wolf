import { GamePlayer } from '../entities/game-player.entity';
import { GameVote } from '../entities/game-vote.entity';
import { VoteTally } from './vote-tally.service';

// Treo cổ người bị vote nhiều nhất ở pha DAY. Không áp dụng che của Bảo vệ hay thuốc men gì —
// cả hai chỉ có tác dụng ban đêm.
export class DayLynchService {
  static resolveLynch(
    votes: GameVote[],
    players: GamePlayer[],
  ): GamePlayer | null {
    const targetId = VoteTally.pickUniqueMaxTarget(
      VoteTally.tallyByTarget(votes),
    );
    if (targetId === null) return null;

    const target = players.find((p) => p.isOwnedBy(targetId));
    if (!target) return null;

    target.kill();
    return target;
  }
}
