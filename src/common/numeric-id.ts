export abstract class NumericId<Self extends NumericId<Self>> {
  protected constructor(protected readonly value: number) {}

  toNumber(): number {
    return this.value;
  }

  equals(other: Self): boolean {
    return this.value === other.value;
  }
}

export function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} không hợp lệ: ${value}`);
  }
}
