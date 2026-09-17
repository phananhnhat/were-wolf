import { Game } from '../entities/game.entity';
import { GamePlayer } from '../entities/game-player.entity';
import { Role } from '../value-objects/role.vo';
import { PlayerId } from '../value-objects/player-id.vo';
import { GamePhase } from '../enums/game-phase.enum';
import { PlayerDeadError } from '../errors/player-dead.error';
import { RoleNotAllowedError } from '../errors/role-not-allowed.error';
import { TargetNotFoundError } from '../errors/target-not-found.error';
import { TargetNotAliveError } from '../errors/target-not-alive.error';
import { SelfTargetNotAllowedError } from '../errors/self-target-not-allowed.error';
import { WerewolfVoteRuleError } from '../errors/werewolf-vote-rule.error';
import { GuardianRepeatTargetError } from '../errors/guardian-repeat-target.error';
import { HealPoisonConflictError } from '../errors/heal-poison-conflict.error';
import { NoVictimToHealError } from '../errors/no-victim-to-heal.error';

// Gom các luật dùng chung cho mọi kỹ năng/bỏ phiếu — 1-1 với các assertion helper hiện có
// trong GameService. `game`/`actor`/`target` được nơi gọi (use case ở bước sau) fetch sẵn qua
// repository rồi truyền vào; GameNotFoundError/PlayerNotInGameError (khi repository trả về
// null) là việc của nơi gọi, KHÔNG nằm ở đây — service này chỉ kiểm tra invariant trên các
// domain object đã có trong tay, không tự đi tìm chúng.
export class GameRulesService {
  // Các kiểm tra CHUNG cho mọi kỹ năng — ván đang chạy, đúng pha, đúng vai, còn sống. KHÔNG
  // kiểm tra "đã dùng chưa" — phạm vi đó (mỗi đêm với Tiên tri/Bảo vệ, cả ván với Phù thuỷ) là
  // luật RIÊNG của từng vai, do GameActionRepository trả lời. Xem docs/impl-phu-thuy.md §3.4.
  static assertCanUseSkill(
    game: Game,
    actor: GamePlayer,
    requiredRole: Role,
    roleLabel: string,
    requiredPhase: GamePhase,
  ): void {
    game.assertInProgress();
    game.assertPhase(requiredPhase, 'skill');

    if (!actor.role.equals(requiredRole)) {
      throw RoleNotAllowedError.forSkill(roleLabel);
    }
    if (!actor.isAlive) {
      throw PlayerDeadError.forSkill();
    }
  }

  // Các kiểm tra CHUNG cho mọi kiểu bỏ phiếu — áp dụng như nhau cho cắn lẫn treo cổ. KHÔNG
  // kiểm tra ai được vote hay vote được ai — luật đó là riêng của bỏ phiếu cắn
  // (assertWolfVoteRules). Xem docs/impl-phu-thuy.md §3.3, §3.4.
  static assertCanVote(
    game: Game,
    voter: GamePlayer,
    target: GamePlayer | null,
    requiredPhase: GamePhase,
  ): asserts target is GamePlayer {
    game.assertInProgress();
    game.assertPhase(requiredPhase, 'vote');

    if (!voter.isAlive) {
      throw PlayerDeadError.forVote();
    }

    GameRulesService.assertLivingTarget(target);
  }

  static assertLivingTarget(
    target: GamePlayer | null,
  ): asserts target is GamePlayer {
    if (!target) throw new TargetNotFoundError();
    if (!target.isAlive) throw new TargetNotAliveError();
  }

  static assertNotSelfTarget(
    actorId: PlayerId,
    targetId: PlayerId,
    action: string,
  ): void {
    if (actorId.equals(targetId)) {
      throw new SelfTargetNotAllowedError(action);
    }
  }

  // Luật riêng của bỏ phiếu cắn: chỉ Sói được vote, và không được chọn Sói khác (tự cắn mình
  // cũng nằm trong luật này vì actor cũng là Sói).
  static assertWolfVoteRules(voter: GamePlayer, target: GamePlayer): void {
    if (!voter.isWerewolf()) {
      throw WerewolfVoteRuleError.onlyWerewolfCanVote();
    }
    if (target.isWerewolf()) {
      throw WerewolfVoteRuleError.cannotTargetAlly();
    }
  }

  // Không được che cùng một người 2 đêm liên tiếp.
  static assertGuardianNotRepeatingTarget(
    targetId: PlayerId,
    lastNightTargetId: PlayerId | null,
  ): void {
    if (lastNightTargetId?.equals(targetId)) {
      throw new GuardianRepeatTargetError();
    }
  }

  // Chiều chặn "vừa cứu vừa độc cùng một người".
  static assertWitchNotHealingPoisonedTarget(
    healTargetId: PlayerId,
    poisonTargetId: PlayerId | null,
  ): void {
    if (poisonTargetId?.equals(healTargetId)) {
      throw new HealPoisonConflictError();
    }
  }

  static assertVictimExistsToHeal(
    victimId: PlayerId | null,
  ): asserts victimId is PlayerId {
    if (victimId === null) {
      throw new NoVictimToHealError();
    }
  }

  // Bây giờ bấm bỏ phiếu có được không — cùng bộ điều kiện assertCanVote kiểm tra, nhưng trả
  // boolean thay vì throw (dùng để hiển thị UI, xem getMyState()).
  static canVoteNow(game: Game, player: GamePlayer): boolean {
    if (!game.isInProgress()) return false;
    if (!player.isAlive) return false;
    if (game.isPhase(GamePhase.NIGHT)) return player.isWerewolf();
    if (game.isPhase(GamePhase.DAY)) return true;
    return false; // SKILL — không ai bỏ phiếu được ở pha này
  }

  // Điều kiện chung để dùng kỹ năng NGAY LÚC NÀY — KHÔNG tính "đã dùng chưa".
  static canUseSkillNow(
    game: Game,
    player: GamePlayer,
    requiredPhase: GamePhase,
  ): boolean {
    return game.isInProgress() && game.isPhase(requiredPhase) && player.isAlive;
  }

  // Ván này có cần mở pha SKILL không — chỉ khi còn Phù thuỷ sống. KHÔNG được xét thêm "còn
  // thuốc hay không": bỏ pha vì hết thuốc là rò rỉ (lộ Phù thuỷ đã cạn cả 2 bình). Xem
  // docs/impl-phu-thuy.md §3.1.
  static hasAliveWitch(players: GamePlayer[]): boolean {
    return players.some((p) => p.isAlive && p.role.equals(Role.WITCH));
  }
}
