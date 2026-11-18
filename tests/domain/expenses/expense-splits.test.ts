import {
  calculatePercentageShares,
  calculateSplitShares,
  formatPercentageInput,
  parsePercentageInput,
  PERCENTAGE_TOTAL_BPS,
  validateSplit,
} from '../../../src/domain/expenses/expense-splits';
import {
  calculateBalances,
  calculateDirectTransfers,
  calculateShares,
  minimizeTransfers,
} from '../../../src/domain/expenses/expense-calculator';
import { Expense, PersonId } from '../../../src/domain/expenses/expense-types';

const people: PersonId[] = ['a', 'b', 'c'];

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  getTogetherId: 'gt1',
  payerId: 'a',
  description: 'Cena',
  amountInt: 100,
  participantIds: people,
  splitMode: 'equal',
  splitValues: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('validateSplit', () => {
  test('equal mode needs no values', () => {
    expect(validateSplit('equal', 100, people, null)).toBeNull();
  });

  test('exact mode requires every participant and the total amount', () => {
    expect(validateSplit('exact', 100, people, { a: 50, b: 30, c: 20 })).toBeNull();
    expect(validateSplit('exact', 100, people, { a: 50, b: 30 })).toBe('missing');
    expect(validateSplit('exact', 100, people, { a: 50, b: 30, c: 10 })).toBe('sum');
    expect(validateSplit('exact', 100, people, { a: -1, b: 1, c: 100 })).toBe('negative');
    expect(validateSplit('exact', 100, people, { a: 1.5, b: 1, c: 97.5 })).toBe('invalid');
  });

  test('percentage mode requires basis points adding up to 100%', () => {
    expect(
      validateSplit('percentage', 100, people, { a: 5000, b: 3000, c: 2000 })
    ).toBeNull();
    expect(validateSplit('percentage', 100, people, { a: 5000, b: 3000 })).toBe('missing');
    expect(
      validateSplit('percentage', 100, people, { a: 5000, b: 3000, c: 1000 })
    ).toBe('sum');
    expect(
      validateSplit('percentage', 100, people, { a: -1, b: 0, c: 10001 })
    ).toBe('negative');
  });
});

describe('calculateSplitShares', () => {
  test('keeps equal as the default and the exact total', () => {
    expect(calculateShares(expense())).toEqual({ a: 34, b: 33, c: 33 });
    expect(calculateShares(expense({ splitMode: null, splitValues: null }))).toEqual({
      a: 34,
      b: 33,
      c: 33,
    });
  });

  test('uses exact amounts when the split is valid', () => {
    expect(
      calculateShares(
        expense({ splitMode: 'exact', splitValues: { a: 70, b: 30, c: 0 } })
      )
    ).toEqual({ a: 70, b: 30, c: 0 });
  });

  test('falls back to equal shares when stored exact data is invalid', () => {
    expect(
      calculateShares(expense({ splitMode: 'exact', splitValues: { a: 70, b: 20, c: 0 } }))
    ).toEqual({ a: 34, b: 33, c: 33 });
  });

  test('rounds percentage shares and gives leftover pesos to the largest remainders', () => {
    const shares = calculatePercentageShares(100, people, {
      a: 3334,
      b: 3333,
      c: 3333,
    });
    expect(shares).toEqual({ a: 34, b: 33, c: 33 });
    expect(Object.values(shares).reduce((x, y) => x + y, 0)).toBe(100);

    expect(
      calculateShares(
        expense({ splitMode: 'percentage', splitValues: { a: 5000, b: 2500, c: 2500 } })
      )
    ).toEqual({ a: 50, b: 25, c: 25 });
  });

  test('percentage rounding is deterministic with many participants', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const shares = calculateSplitShares(
      'percentage',
      30,
      ids,
      Object.fromEntries(ids.map((id) => [id, Math.floor(PERCENTAGE_TOTAL_BPS / ids.length)]))
    );
    expect(Object.values(shares).reduce((x, y) => x + y, 0)).toBe(30);
    expect(Math.max(...Object.values(shares)) - Math.min(...Object.values(shares))).toBeLessThanOrEqual(1);
  });
});

describe('percentage input helpers', () => {
  test('parses comma or dot with up to two decimals into basis points', () => {
    expect(parsePercentageInput('12.5')).toBe(1250);
    expect(parsePercentageInput('12,5')).toBe(1250);
    expect(parsePercentageInput('100')).toBe(10000);
    expect(parsePercentageInput('')).toBe(0);
    expect(parsePercentageInput('12.345')).toBeNull();
    expect(parsePercentageInput('101')).toBeNull();
  });

  test('formats basis points for the input', () => {
    expect(formatPercentageInput(5000)).toBe('50');
    expect(formatPercentageInput(3334)).toBe('33.34');
    expect(formatPercentageInput(1250)).toBe('12.5');
  });

  test('default even percentages round-trip to exactly 100%', () => {
    for (let count = 1; count <= 12; count++) {
      const base = Math.floor(PERCENTAGE_TOTAL_BPS / count);
      const remainder = PERCENTAGE_TOTAL_BPS % count;
      const texts = Array.from({ length: count }, (_, index) =>
        formatPercentageInput(base + (index < remainder ? 1 : 0))
      );
      const parsed = texts.map((text) => parsePercentageInput(text));
      expect(parsed).not.toContain(null);
      expect(parsed.reduce<number>((total, value) => total + (value ?? 0), 0)).toBe(PERCENTAGE_TOTAL_BPS);
    }
  });
});

describe('balances with unequal splits', () => {
  test('exact and percentage shares feed balances and transfers', () => {
    const exact = expense({ payerId: 'a', splitMode: 'exact', splitValues: { a: 20, b: 80, c: 0 } });
    const percentage = expense({
      id: 'e2',
      payerId: 'b',
      amountInt: 50,
      splitMode: 'percentage',
      splitValues: { a: 2000, b: 0, c: 8000 },
    });
    const balances = calculateBalances([exact, percentage]);
    const byId = new Map(balances.map((balance) => [balance.personId, balance.net]));
    expect(byId.get('a')).toBe(100 - 20 - 10);
    expect(byId.get('b')).toBe(50 - 80);
    expect(byId.get('c')).toBe(0 - 0 - 40);

    expect(calculateDirectTransfers([exact, percentage])).toEqual([
      { from: 'b', to: 'a', amount: 30 },
      { from: 'c', to: 'a', amount: 40 },
    ]);
    expect(minimizeTransfers([exact, percentage])).toEqual([
      { from: 'c', to: 'a', amount: 40 },
      { from: 'b', to: 'a', amount: 30 },
    ]);
  });
});
