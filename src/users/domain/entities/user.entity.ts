import { UserId } from '../value-objects/user-id.vo';

// Aggregate root của một người dùng. `passwordHash` là chuỗi đã hash sẵn — Domain không biết
// (và không cần biết) thuật toán hash là gì, đó là việc của PasswordHasher port ở
// AuthModule/Application layer.
export class User {
  private _id: UserId | null;

  private constructor(
    id: UserId | null,
    private _name: string,
    readonly username: string,
    readonly email: string,
    private _address: string | null,
    private _gender: string | null,
    private _passwordHash: string,
    readonly createdAt: Date,
  ) {
    this._id = id;
  }

  static register(props: {
    name: string;
    username: string;
    email: string;
    address?: string | null;
    gender?: string | null;
    passwordHash: string;
  }): User {
    return new User(
      null,
      props.name,
      props.username,
      props.email,
      props.address ?? null,
      props.gender ?? null,
      props.passwordHash,
      new Date(),
    );
  }

  static reconstitute(props: {
    id: UserId;
    name: string;
    username: string;
    email: string;
    address: string | null;
    gender: string | null;
    passwordHash: string;
    createdAt: Date;
  }): User {
    return new User(
      props.id,
      props.name,
      props.username,
      props.email,
      props.address,
      props.gender,
      props.passwordHash,
      props.createdAt,
    );
  }

  get id(): UserId {
    if (!this._id) {
      throw new Error('User chưa được lưu nên chưa có id');
    }
    return this._id;
  }

  assignId(id: UserId): void {
    if (this._id) {
      throw new Error('User đã có id, không gán lại được');
    }
    this._id = id;
  }

  hasId(): boolean {
    return this._id !== null;
  }

  get name(): string {
    return this._name;
  }

  get address(): string | null {
    return this._address;
  }

  get gender(): string | null {
    return this._gender;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  updateName(name: string): void {
    this._name = name;
  }

  changePasswordHash(hash: string): void {
    this._passwordHash = hash;
  }
}
