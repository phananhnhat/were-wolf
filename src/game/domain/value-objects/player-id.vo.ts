import { NumericId, assertPositiveInteger } from '../../../common/numeric-id';

// Id của User trong ngữ cảnh một ván chơi. Game domain định nghĩa kiểu riêng của mình thay vì
// phụ thuộc vào UserId của Users context — mỗi bounded context tự chủ kiểu id nó cần.
export class PlayerId extends NumericId<PlayerId> {
  static of(value: number): PlayerId {
    assertPositiveInteger(value, 'PlayerId');
    return new PlayerId(value);
  }
}
