import { Expense, PersonId, Settlement } from '../../../src/domain/expenses/expense-types';
import {
  calculateBalances,
  calculateDirectTransfers,
  calculateShares,
  minimizeTransfers,
} from '../../../src/domain/expenses/expense-calculator';

const p = (id: string): PersonId => id;
const exp = (
  id: string,
  payer: PersonId,
  amount: number,
  participants: PersonId[],
  overrides?: Partial<Expense>
): Expense => ({
  id,
  getTogetherId: 'gt1',
  payerId: payer,
  description: id,
  amountInt: amount,
  participantIds: participants,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const stl = (
  id: string,
  from: PersonId,
  to: PersonId,
  amount: number,
  overrides?: Partial<Settlement>
): Settlement => ({
  id,
  getTogetherId: 'gt1',
  fromId: from,
  toId: to,
  amountInt: amount,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('expenses - division igualitaria', () => {
  test('divide equally with integer remainder to first participants', () => {
    const e = exp('e1', p('a'), 30, [p('a'), p('b'), p('c'), p('d'), p('e'), p('f'), p('g')]);
    const shares = calculateShares(e);
    const vals = Object.values(shares);
    expect(vals.reduce((x, y) => x + y, 0)).toBe(30);
    const fives = vals.filter((v) => v === 5).length;
    const fours = vals.filter((v) => v === 4).length;
    expect(fives).toBe(2);
    expect(fours).toBe(5);
  });

  test('participants different from payer', () => {
    const e = exp('e1', p('a'), 30, [p('b'), p('c'), p('d'), p('e'), p('f'), p('g')]);
    const shares = calculateShares(e);
    expect(Object.values(shares).reduce((x, y) => x + y, 0)).toBe(30);
    expect(shares[p('b')]).toBe(5);
  });

  test('multiple expenses balances', () => {
    const e1 = exp('e1', p('a'), 30, [p('a'), p('b'), p('c')]);
    const e2 = exp('e2', p('b'), 15, [p('a'), p('b')]);
    const bals = calculateBalances([e1, e2]);
    const m: Record<string, number> = {};
    bals.forEach((b) => (m[b.personId] = b.net));
    expect(m[p('a')]).toBe(30 - 10 + 0 - 8);
    expect(m[p('b')]).toBe(0 - 10 + 15 - 7);
    expect(m[p('c')]).toBe(0 - 10);
  });

  test('minimize transfers reduces count', () => {
    const expenses = [
      exp('e1', p('a'), 30, [p('a'), p('b'), p('c')]),
      exp('e2', p('b'), 15, [p('a'), p('b')]),
      exp('e3', p('c'), 9, [p('a'), p('b'), p('c'), p('d')]),
    ];
    const direct = minimizeTransfers(expenses);
    expect(direct.length).toBeGreaterThan(0);
  });
});

describe('expenses - edicion', () => {
  test('editing the amount recomputes balances', () => {
    const original = exp('e1', p('a'), 30, [p('a'), p('b')]);
    const before = calculateBalances([original]);
    expect(before.find((b) => b.personId === p('a'))?.net).toBe(15);

    const edited = exp('e1', p('a'), 10, [p('a'), p('b')], { amountInt: 10 });
    const after = calculateBalances([edited]);
    expect(after.find((b) => b.personId === p('a'))?.net).toBe(5);
    expect(after.find((b) => b.personId === p('b'))?.net).toBe(-5);
  });

  test('editing the payer and participants recomputes balances', () => {
    const edited = exp('e1', p('b'), 30, [p('b'), p('c')]);
    const bals = calculateBalances([edited]);
    const m: Record<string, number> = {};
    bals.forEach((b) => (m[b.personId] = b.net));
    expect(m[p('b')]).toBe(15);
    expect(m[p('c')]).toBe(-15);
  });
});

describe('expenses - saldar deudas', () => {
  test('a settlement cancels the debt between two people', () => {
    const e = exp('e1', p('a'), 30, [p('a'), p('b')]);
    const before = calculateBalances([e]);
    expect(before.find((b) => b.personId === p('b'))?.net).toBe(-15);

    const after = calculateBalances([e], [stl('s1', p('b'), p('a'), 15)]);
    expect(after.find((b) => b.personId === p('b'))?.net).toBe(0);
    expect(after.find((b) => b.personId === p('a'))?.net).toBe(0);
  });

  test('partial settlement leaves the remaining debt', () => {
    const e = exp('e1', p('a'), 30, [p('a'), p('b')]);
    const bals = calculateBalances([e], [stl('s1', p('b'), p('a'), 5)]);
    const m: Record<string, number> = {};
    bals.forEach((b) => (m[b.personId] = b.net));
    expect(m[p('a')]).toBe(10);
    expect(m[p('b')]).toBe(-10);
  });

  test('transfers disappear once the debt is settled', () => {
    const e = exp('e1', p('a'), 30, [p('a'), p('b')]);
    expect(minimizeTransfers([e])).toEqual([{ from: p('b'), to: p('a'), amount: 15 }]);
    expect(minimizeTransfers([e], [stl('s1', p('b'), p('a'), 15)])).toEqual([]);
    expect(calculateDirectTransfers([e], [stl('s1', p('b'), p('a'), 15)])).toEqual([]);
  });

  test('deleted settlements are ignored', () => {
    const e = exp('e1', p('a'), 30, [p('a'), p('b')]);
    const bals = calculateBalances([e], [stl('s1', p('b'), p('a'), 15, { deletedAt: new Date() })]);
    expect(bals.find((b) => b.personId === p('b'))?.net).toBe(-15);
  });
});
