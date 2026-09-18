import { GameRepository } from '../../domain/repositories/game.repository';
import { GamePlayerRepository } from '../../domain/repositories/game-player.repository';
import { GameVoteRepository } from '../../domain/repositories/game-vote.repository';
import { GameId } from '../../domain/value-objects/game-id.vo';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { GamePhase } from '../../domain/enums/game-phase.enum';
import { GameVote } from '../../domain/entities/game-vote.entity';
import { GameRulesService } from '../../domain/services/game-rules.service';
import { GameNotFoundError } from '../../domain/errors/game-not-found.error';
import { PlayerNotInGameError } from '../../domain/errors/player-not-in-game.error';
import { RealtimeGamePublisher } from '../ports/realtime-game-publisher';
import { getVoteTally, VoteTallyOutput } from './get-vote-tally.use-case';

// Cả làng bỏ/đổi phiếu treo cổ — chỉ dùng được ở pha DAY. Gọi lại nhiều lần trong cùng lượt =
// đổi phiếu, không cộng dồn. Không có luật riêng nào thêm — ai còn sống cũng vote được, chọn
// được bất kỳ ai kể cả Sói.
export async function castLynchVote(
  games: GameRepository,
  players: GamePlayerRepository,
  votes: GameVoteRepository,
  realtime: RealtimeGamePublisher,
  gameId: number,
  voterId: number,
  targetUserId: number,
): Promise<VoteTallyOutput> {
  const gid = GameId.of(gameId);
  const voterPid = PlayerId.of(voterId);
  const targetPid = PlayerId.of(targetUserId);

  const game = await games.findById(gid);
  if (!game) throw new GameNotFoundError();

  const voter = await players.findByGameAndUser(gid, voterPid);
  if (!voter) throw new PlayerNotInGameError();

  const target = await players.findByGameAndUser(gid, targetPid);
  GameRulesService.assertCanVote(game, voter, target, GamePhase.DAY);

  const existing = await votes.findByVoter(
    gid,
    GamePhase.DAY,
    game.dayNumber,
    voterPid,
  );
  if (existing) {
    existing.changeTarget(targetPid);
    await votes.save(existing);
  } else {
    await votes.save(
      GameVote.cast(gameId, GamePhase.DAY, game.dayNumber, voterPid, targetPid),
    );
  }

  // Tally treo cổ công khai — đẩy thẳng qua MQTT, ai trong ván cũng xem được (đúng luật REST
  // hiện có). KHÔNG kèm myVoteTargetId của result — field đó riêng của voterId, phát đi cho cả
  // phòng sẽ sai nghĩa với người nhận khác.
  const result = await getVoteTally(games, players, votes, gameId, voterId, {
    phase: GamePhase.DAY,
    wolfOnly: false,
  });
  realtime.publishLynchVotes(game.roomId, {
    gameId,
    dayNumber: result.dayNumber,
    tally: result.tally,
  });
  return result;
}
