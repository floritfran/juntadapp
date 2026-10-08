import {
  addGeneralaEntry,
  availableBoxes,
  computeGeneralaTotals,
  generalaStandings,
  generalaWinners,
  isBoxAvailable,
  isGeneralaComplete,
  isUpperBox,
  nextGeneralaTurn,
  tacharEntry,
  UPPER_BONUS_POINTS,
} from '../../../../src/domain/games/generala/generala-scorer';
import { GeneralaEntry, GENERALA_BOXES } from '../../../../src/domain/games/generala/generala-types';

const entry = (box: GeneralaEntry['box'], points: number): GeneralaEntry => ({ box, points, tachado: false });
const fullSheet = (): GeneralaEntry[] => GENERALA_BOXES.map((box) => entry(box, 0));

describe('generala - casilleros', () => {
  test('all 11 boxes available at the start', () => {
    expect(availableBoxes([])).toHaveLength(11);
  });

  test('filled box is no longer available', () => {
    const entries = [entry('ones', 4)];
    expect(isBoxAvailable(entries, 'ones')).toBe(false);
    expect(availableBoxes(entries)).toHaveLength(10);
  });

  test('rejects filling the same box twice', () => {
    const entries = [entry('full', 30)];
    expect(() => addGeneralaEntry(entries, entry('full', 35))).toThrow();
  });

  test('rejects negative or fractional points', () => {
    expect(() => addGeneralaEntry([], entry('ones', -1))).toThrow();
    expect(() => addGeneralaEntry([], entry('ones', 2.5))).toThrow();
  });

  test('upper boxes classification', () => {
    expect(isUpperBox('sixes')).toBe(true);
    expect(isUpperBox('poker')).toBe(false);
  });
});

describe('generala - tachar', () => {
  test('tachar forces zero points', () => {
    const entries = addGeneralaEntry([], { box: 'poker', points: 45, tachado: true });
    expect(entries[0]).toEqual({ box: 'poker', points: 0, tachado: true });
  });

  test('tachar works on lower boxes too', () => {
    const entries = addGeneralaEntry([], tacharEntry('generala'));
    expect(entries[0].points).toBe(0);
    expect(isGeneralaComplete(entries)).toBe(false);
  });
});

describe('generala - totales y bonificación', () => {
  test('upper bonus applies at 63 or more', () => {
    const entries = [entry('ones', 3), entry('twos', 6), entry('threes', 9), entry('fours', 12), entry('fives', 15), entry('sixes', 18)];
    const totals = computeGeneralaTotals(entries);
    expect(totals.upper).toBe(63);
    expect(totals.upperBonus).toBe(UPPER_BONUS_POINTS);
    expect(totals.total).toBe(98);
  });

  test('no upper bonus below threshold', () => {
    const entries = [entry('ones', 5), entry('twos', 10), entry('threes', 15), entry('fours', 20), entry('fives', 10), entry('sixes', 2)];
    const totals = computeGeneralaTotals(entries);
    expect(totals.upper).toBe(62);
    expect(totals.upperBonus).toBe(0);
  });

  test('lower boxes sum into total', () => {
    const entries = [entry('escalera', 25), entry('full', 35), entry('poker', 45), entry('generala', 55), entry('dobleGenerala', 100)];
    const totals = computeGeneralaTotals(entries);
    expect(totals.lower).toBe(260);
    expect(totals.total).toBe(260);
  });

  test('missing boxes count as zero', () => {
    expect(computeGeneralaTotals([])).toEqual({ upper: 0, upperBonus: 0, lower: 0, total: 0 });
  });
});

describe('generala - turnos', () => {
  test('first player starts', () => {
    expect(nextGeneralaTurn(['a', 'b'], { a: [], b: [] })).toEqual({ personId: 'a', index: 0 });
  });

  test('passes to the next player with open boxes', () => {
    const fullA = fullSheet();
    expect(nextGeneralaTurn(['a', 'b'], { a: fullA, b: [] })).toEqual({ personId: 'b', index: 1 });
  });

  test('wraps around when the next player is complete', () => {
    const fullB = fullSheet();
    expect(nextGeneralaTurn(['a', 'b'], { a: [entry('ones', 1)], b: fullB })).toEqual({ personId: 'a', index: 0 });
  });

  test('returns null when every box is filled', () => {
    expect(nextGeneralaTurn(['a'], { a: fullSheet() })).toBeNull();
  });

  test('one play per player: passes the turn after each entry', () => {
    const order = ['a', 'b', 'c'];
    expect(nextGeneralaTurn(order, { a: [], b: [], c: [] })).toEqual({ personId: 'a', index: 0 });
    expect(nextGeneralaTurn(order, { a: [entry('ones', 3)], b: [], c: [] })).toEqual({ personId: 'b', index: 1 });
    expect(
      nextGeneralaTurn(order, { a: [entry('ones', 3)], b: [entry('ones', 5)], c: [] })
    ).toEqual({ personId: 'c', index: 2 });
    expect(
      nextGeneralaTurn(order, {
        a: [entry('ones', 3)],
        b: [entry('ones', 5)],
        c: [entry('twos', 2)],
      })
    ).toEqual({ personId: 'a', index: 0 });
  });

  test('skips players that filled every box', () => {
    expect(
      nextGeneralaTurn(['a', 'b'], { a: fullSheet(), b: [entry('ones', 4), entry('twos', 8)] })
    ).toEqual({ personId: 'b', index: 1 });
  });
});

describe('generala - standings y ganador', () => {
  test('orders players by total descending', () => {
    const standings = generalaStandings(['a', 'b'], {
      a: [entry('ones', 5)],
      b: [entry('ones', 3), entry('full', 30)],
    });
    expect(standings.map((row) => row.personId)).toEqual(['b', 'a']);
  });

  test('tie returns all winners', () => {
    expect(generalaWinners(['a', 'b'], { a: [entry('ones', 5)], b: [entry('twos', 5)] })).toEqual(['a', 'b']);
  });
});
