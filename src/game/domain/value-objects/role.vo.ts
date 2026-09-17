import { Faction } from '../enums/faction.enum';

// Ánh xạ role key sang phe — dùng để tính điều kiện thắng (xem docs/game-rules.md §5). Chỉ
// cần liệt kê phe Sói — mọi role không nằm trong danh sách này đều được tính là phe Dân, nên
// thêm vai mới cho phe Dân không phải sửa gì ở đây.
//
// TẠM THỜI trùng với src/game/constants/factions.ts — game.service.ts hiện tại vẫn đọc file
// đó, chưa nối sang domain layer này. Dọn trùng lặp ở bước nối Application layer.
const WEREWOLF_ROLE_KEYS: ReadonlySet<string> = new Set(['werewolf']);

// Bọc role key (chuỗi) lại thành value object biết luôn mình thuộc phe nào — thay vì rải
// WEREWOLF_ROLES.includes(role) khắp nơi như code cũ.
export class Role {
  private constructor(private readonly key: string) {}

  static readonly WEREWOLF = new Role('werewolf');
  static readonly VILLAGER = new Role('villager');
  static readonly GUARDIAN = new Role('guardian'); // mỗi đêm che 1 người khỏi bị Sói cắn
  static readonly SEER = new Role('seer'); // mỗi đêm soi 1 người: có phải Sói không
  static readonly WITCH = new Role('witch'); // 2 bình thuốc dùng 1 lần/cả ván: cứu và độc

  static of(key: string): Role {
    if (!key) throw new Error('Role key không được rỗng');
    return new Role(key);
  }

  toKey(): string {
    return this.key;
  }

  faction(): Faction {
    return WEREWOLF_ROLE_KEYS.has(this.key)
      ? Faction.WEREWOLF
      : Faction.VILLAGER;
  }

  isWerewolf(): boolean {
    return this.faction() === Faction.WEREWOLF;
  }

  equals(other: Role): boolean {
    return this.key === other.key;
  }
}
