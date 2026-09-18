import { NumericId, assertPositiveInteger } from '../../../common/numeric-id';

export class RoomId extends NumericId<RoomId> {
  static of(value: number): RoomId {
    assertPositiveInteger(value, 'RoomId');
    return new RoomId(value);
  }
}
