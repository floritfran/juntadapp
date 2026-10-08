export type MoneyInt = number;

export function splitEvenly(amount: MoneyInt, count: number): MoneyInt[] {
  if (count <= 0) return [];
  const base = Math.floor(amount / count);
  const remainder = amount % count;
  const result: MoneyInt[] = Array(count).fill(base);
  for (let i = 0; i < remainder; i++) {
    result[i] += 1;
  }
  return result;
}

export function sum(values: MoneyInt[]): MoneyInt {
  return values.reduce((acc, v) => acc + v, 0);
}
