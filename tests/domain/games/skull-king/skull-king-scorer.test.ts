import {
  isSkullKingComplete,
  skullKingRoundPoints,
  skullKingTotals,
  validateSkullKingEntry,
  withPoints,
} from '../../../../src/domain/games/skull-king/skull-king-scorer';
import { cardsInRound, SkullKingRoundEntry } from '../../../../src/domain/games/skull-king/skull-king-types';

const sk = (
  round: number,
  personId: string,
  bid: number,
  tricks: number,
  bonus = 0
): SkullKingRoundEntry => ({ round, personId, bid, tricks, bonus });

describe('skull king - acierto exacto', () => {
  test('bid 0 exact gives 10 points per round played', () => {
    expect(skullKingRoundPoints(sk(1, 'a', 0, 0))).toBe(10);
    expect(skullKingRoundPoints(sk(2, 'a', 0, 0))).toBe(20);
    expect(skullKingRoundPoints(sk(3, 'a', 0, 0))).toBe(30);
    expect(skullKingRoundPoints(sk(10, 'a', 0, 0))).toBe(100);
  });

  test('exact bid gives 20 per bid unit', () => {
    expect(skullKingRoundPoints(sk(3, 'a', 2, 2))).toBe(40);
    expect(skullKingRoundPoints(sk(5, 'a', 5, 5))).toBe(100);
  });

  test('exact bid adds bonuses on top', () => {
    expect(skullKingRoundPoints(sk(4, 'a', 3, 3, 70))).toBe(130);
    expect(skullKingRoundPoints(sk(2, 'a', 0, 0, -5))).toBe(15);
  });
});

describe('skull king - fallo', () => {
  test('misses lose 10 per unit of difference', () => {
    expect(skullKingRoundPoints(sk(3, 'a', 2, 3))).toBe(-10);
    expect(skullKingRoundPoints(sk(6, 'a', 4, 1))).toBe(-30);
    expect(skullKingRoundPoints(sk(6, 'a', 1, 4))).toBe(-30);
  });

  test('bid 0 with tricks lost is penalized', () => {
    expect(skullKingRoundPoints(sk(4, 'a', 0, 2))).toBe(-20);
  });

  test('bonuses are ignored on a miss', () => {
    expect(skullKingRoundPoints(sk(4, 'a', 2, 3, 50))).toBe(-10);
  });
});

describe('skull king - cartas por ronda', () => {
  test('round N deals N cards to each player', () => {
    expect(cardsInRound(1)).toBe(1);
    expect(cardsInRound(2)).toBe(2);
    expect(cardsInRound(10)).toBe(10);
  });
});

describe('skull king - validación', () => {
  test('rejects bid above cards dealt in the round', () => {
    expect(() => validateSkullKingEntry(sk(1, 'a', 2, 0))).toThrow();
    expect(() => validateSkullKingEntry(sk(1, 'a', 1, 1))).not.toThrow();
    expect(() => validateSkullKingEntry(sk(4, 'a', 4, 2))).not.toThrow();
    expect(() => validateSkullKingEntry(sk(4, 'a', 5, 2))).toThrow();
  });

  test('rejects tricks above cards dealt in the round', () => {
    expect(() => validateSkullKingEntry(sk(2, 'a', 1, 3))).toThrow();
  });

  test('rejects invalid rounds', () => {
    expect(() => validateSkullKingEntry(sk(0, 'a', 0, 0))).toThrow();
    expect(() => validateSkullKingEntry(sk(11, 'a', 0, 0))).toThrow();
    expect(() => skullKingRoundPoints(sk(0, 'a', 0, 0))).toThrow();
    expect(() => skullKingRoundPoints(sk(11, 'a', 0, 0))).toThrow();
  });

  test('rejects fractional values', () => {
    expect(() => validateSkullKingEntry(sk(3, 'a', 1.5, 1))).toThrow();
    expect(() => validateSkullKingEntry(sk(3, 'a', 1, 1.5))).toThrow();
  });
});

describe('skull king - totales y completitud', () => {
  test('totals accumulate across rounds and sort desc', () => {
    const entries = [sk(1, 'a', 1, 1), sk(1, 'b', 1, 0), sk(2, 'a', 0, 0), sk(2, 'b', 2, 2)];
    expect(skullKingTotals(entries)).toEqual([
      { personId: 'a', total: 40 },
      { personId: 'b', total: 30 },
    ]);
  });

  test('withPoints attaches computed points', () => {
    expect(withPoints(sk(2, 'a', 1, 1)).points).toBe(20);
  });

  test('complete only when every round has every player', () => {
    const entries: SkullKingRoundEntry[] = [];
    for (let round = 1; round <= 10; round += 1) {
      entries.push(sk(round, 'a', 0, 0), sk(round, 'b', 0, 0));
    }
    expect(isSkullKingComplete(entries, 2)).toBe(true);
    expect(isSkullKingComplete(entries, 3)).toBe(false);
    expect(isSkullKingComplete(entries.slice(0, -2), 2)).toBe(false);
    expect(isSkullKingComplete([], 2)).toBe(false);
  });
});
