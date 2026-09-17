import { GamePlayer } from '../entities/game-player.entity';
import { GameWinner } from '../enums/game-winner.enum';

// Xác định phe thắng theo docs/game-rules.md §5, dựa trên số người còn sống. Không có side
// effect — chỉ trả về quyết định, nơi gọi tự quyết có settle ván hay không. Giai đoạn này chỉ
// có 2 phe nên không xét THIRD_PARTY.
export class WinConditionService {
  static decideWinner(players: GamePlayer[]): GameWinner | null {
    const aliveWerewolves = players.filter(
      (p) => p.isAlive && p.isWerewolf(),
    ).length;
    const aliveVillagerSide = players.filter(
      (p) => p.isAlive && !p.isWerewolf(),
    ).length;

    if (aliveWerewolves === 0) return GameWinner.VILLAGER;
    if (aliveWerewolves >= aliveVillagerSide) return GameWinner.WEREWOLF;
    return null;
  }
}
