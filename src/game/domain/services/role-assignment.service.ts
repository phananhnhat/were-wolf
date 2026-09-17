import { Role } from '../value-objects/role.vo';

// Chia vai ngẫu nhiên lúc bắt đầu ván. Nhận `roleConfig` từ nơi gọi (ROLE_CONFIG_BY_MAX_PLAYERS
// hiện sống ở rooms/constants/room-configs.ts) thay vì tự tra theo maxPlayers — Game domain
// không phụ thuộc ngược vào Rooms context.
export class RoleAssignmentService {
  // `rng` mặc định Math.random, nhưng nhận tham số để unit test ra kết quả xác định được mà
  // không cần random thật (ví dụ truyền một PRNG có seed cố định).
  static shuffleRoles(
    roleConfig: Record<string, number>,
    rng: () => number = Math.random,
  ): Role[] {
    const roles: Role[] = [];
    for (const [roleKey, count] of Object.entries(roleConfig)) {
      for (let i = 0; i < count; i++) roles.push(Role.of(roleKey));
    }

    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    return roles;
  }
}
