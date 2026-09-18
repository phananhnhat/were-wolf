import { Injectable } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { PasswordHasher } from '../application/ports/password-hasher';

const SALT_ROUNDS = 10;

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return bcryptjs.hash(plain, SALT_ROUNDS);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcryptjs.compare(plain, hash);
  }
}
