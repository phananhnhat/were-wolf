// PORT — băm/so sánh mật khẩu. Tách ra để Application layer không phải `import * as bcryptjs`
// trực tiếp — giống lý do GameModule có port `Logger` thay vì import @nestjs/common thẳng.
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
