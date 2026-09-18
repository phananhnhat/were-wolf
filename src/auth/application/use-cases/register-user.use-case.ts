import type { UserDirectory } from '../ports/user-directory';
import type { PasswordHasher } from '../ports/password-hasher';
import { UsernameTakenError } from '../../domain/errors/username-taken.error';
import { EmailInUseError } from '../../domain/errors/email-in-use.error';

export interface RegisterInput {
  name: string;
  username: string;
  email: string;
  password: string;
  address?: string;
  gender?: string;
}

export async function registerUser(
  users: UserDirectory,
  hasher: PasswordHasher,
  input: RegisterInput,
): Promise<{ message: string }> {
  if (await users.findByUsername(input.username)) {
    throw new UsernameTakenError();
  }
  if (await users.findByEmail(input.email)) {
    throw new EmailInUseError();
  }

  const passwordHash = await hasher.hash(input.password);
  await users.create({
    name: input.name,
    username: input.username,
    email: input.email,
    address: input.address,
    gender: input.gender,
    passwordHash,
  });

  return { message: 'Registered successfully' };
}
