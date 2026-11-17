import { calculateBalances, minimizeTransfers } from '../../../src/domain/expenses/expense-calculator';
import { Expense, PersonId } from '../../../src/domain/expenses/expense-types';
import {
  findExpensePayers,
  reassignExpensesToParticipants,
  sameParticipants,
} from '../../../src/domain/get-togethers/get-together-edits';

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

const balanceMap = (expenses: Expense[]) => {
  const map = new Map<string, number>();
  calculateBalances(expenses).forEach((balance) => map.set(balance.personId, balance.net));
  return map;
};

describe('get-together edits - participantes', () => {
  test('sameParticipants ignores order and detects additions and removals', () => {
    expect(sameParticipants([p('a'), p('b')], [p('b'), p('a')])).toBe(true);
    expect(sameParticipants([p('a'), p('b')], [p('a'), p('b'), p('c')])).toBe(false);
    expect(sameParticipants([p('a'), p('b'), p('c')], [p('a'), p('b')])).toBe(false);
  });

  test('findExpensePayers returns only payers of active expenses', () => {
    const e1 = exp('e1', p('a'), 90, [p('a'), p('b'), p('c')]);
    const e2 = exp('e2', p('d'), 50, [p('d'), p('e')]);
    const deleted = exp('e3', p('z'), 10, [p('z'), p('y')], { deletedAt: new Date() });

    expect([...findExpensePayers([e1, e2, deleted])].sort()).toEqual([p('a'), p('d')]);
    expect(findExpensePayers([deleted]).size).toBe(0);
  });

  test('reassignExpensesToParticipants replaces participants on active expenses only', () => {
    const active = exp('e1', p('a'), 90, [p('a'), p('b'), p('c')]);
    const deleted = exp('e2', p('b'), 50, [p('b'), p('c')], { deletedAt: new Date() });
    const result = reassignExpensesToParticipants([active, deleted], [p('a'), p('b'), p('c'), p('d')]);

    expect(result).toHaveLength(1);
    expect(result[0].participantIds).toEqual([p('a'), p('b'), p('c'), p('d')]);
    expect(result[0].amountInt).toBe(90);
    expect(active.participantIds).toEqual([p('a'), p('b'), p('c')]);
  });

  test('recalculates balances when a participant is added', () => {
    const expenses = [exp('e1', p('a'), 90, [p('a'), p('b'), p('c')])];
    const before = balanceMap(expenses);
    expect(before.get(p('a'))).toBe(60);
    expect(before.get(p('b'))).toBe(-30);
    expect(before.get(p('c'))).toBe(-30);

    const after = balanceMap(reassignExpensesToParticipants(expenses, [p('a'), p('b'), p('c'), p('d')]));
    expect(after.get(p('a'))).toBe(67);
    expect(after.get(p('b'))).toBe(-23);
    expect(after.get(p('c'))).toBe(-22);
    expect(after.get(p('d'))).toBe(-22);
  });

  test('recalculates balances when a participant is removed', () => {
    const expenses = [exp('e1', p('a'), 60, [p('a'), p('b'), p('c')])];
    const after = balanceMap(reassignExpensesToParticipants(expenses, [p('a'), p('b')]));

    expect(after.get(p('a'))).toBe(30);
    expect(after.get(p('b'))).toBe(-30);
    expect(after.has(p('c'))).toBe(false);
  });

  test('pending transfers follow the recalculated balances', () => {
    const expenses = [exp('e1', p('a'), 90, [p('a'), p('b'), p('c')])];
    const updated = reassignExpensesToParticipants(expenses, [p('a'), p('b'), p('c'), p('d')]);
    const transfers = minimizeTransfers(updated);

    expect(transfers).toEqual([
      { from: p('b'), to: p('a'), amount: 23 },
      { from: p('c'), to: p('a'), amount: 22 },
      { from: p('d'), to: p('a'), amount: 22 },
    ]);
  });
});
