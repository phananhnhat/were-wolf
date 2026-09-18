import { NumericId, assertPositiveInteger } from '../../../common/numeric-id';

// Bọc id số nguyên của User — tránh truyền nhầm id của aggregate khác vào chỗ cần UserId.
export class UserId extends NumericId<UserId> {
  static of(value: number): UserId {
    assertPositiveInteger(value, 'UserId');
    return new UserId(value);
  }
}
