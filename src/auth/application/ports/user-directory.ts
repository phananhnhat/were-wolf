// Port do AuthModule tự định nghĩa cho đúng thứ mình cần từ "người dùng" — KHÔNG tái dùng
// UserRepository/User của UsersModule ở Domain/Application layer (giống cách RoomsModule tự
// định nghĩa GameStatusReader thay vì tái dùng GameRepository của GameModule). Domain/Application
// của AuthModule chỉ biết tới AuthUserRecord/UserDirectory ở đây — không biết UsersModule tồn
// tại. Chỉ có 1 Infrastructure adapter (user-directory.adapter.ts) được phép biết cả 2.
export interface AuthUserRecord {
  id: number;
  username: string;
  passwordHash: string;
}

export interface NewUserInput {
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  address?: string | null;
  gender?: string | null;
}

export interface UserDirectory {
  findByUsername(username: string): Promise<AuthUserRecord | null>;
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(id: number): Promise<AuthUserRecord | null>;
  create(input: NewUserInput): Promise<void>;
  updatePasswordHash(id: number, passwordHash: string): Promise<void>;
}

export const USER_DIRECTORY = Symbol('USER_DIRECTORY');
