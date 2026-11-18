import {
  filterGetTogethers,
  getMonthKey,
  hasActiveGetTogetherFilters,
  monthKeyFrom,
  parseMonthKey,
  type GetTogetherFilterable,
  type GetTogetherFilters,
} from '../../../src/domain/get-togethers/get-together-filters';

const items: GetTogetherFilterable[] = [
  {
    name: 'Asado de los pibes',
    date: new Date(2026, 0, 15),
    participantIds: ['ana', 'beto'],
  },
  {
    name: 'Fútbol enero',
    date: new Date(2026, 0, 28),
    participantIds: ['ana', 'carlos'],
  },
  {
    name: 'Cena de febrero',
    date: new Date(2026, 1, 5),
    participantIds: ['beto', 'carlos'],
  },
];

const noFilters: GetTogetherFilters = { query: '', month: null, participantIds: [] };

describe('getMonthKey', () => {
  test('uses local year and zero-padded month', () => {
    expect(getMonthKey(new Date(2026, 0, 15))).toBe('2026-01');
    expect(getMonthKey(new Date(2026, 10, 3))).toBe('2026-11');
  });
});

describe('monthKeyFrom', () => {
  test('zero-pads the month', () => {
    expect(monthKeyFrom(2026, 1)).toBe('2026-01');
    expect(monthKeyFrom(2025, 12)).toBe('2025-12');
  });
});

describe('parseMonthKey', () => {
  test('parses valid month keys', () => {
    expect(parseMonthKey('2026-01')).toEqual({ year: 2026, month: 1 });
    expect(parseMonthKey('2025-12')).toEqual({ year: 2025, month: 12 });
  });

  test('rejects invalid month keys', () => {
    expect(parseMonthKey('2026-13')).toBeNull();
    expect(parseMonthKey('2026-1')).toBeNull();
    expect(parseMonthKey('not-a-month')).toBeNull();
  });
});

describe('hasActiveGetTogetherFilters', () => {
  test('is false only when no text, month or participants are selected', () => {
    expect(hasActiveGetTogetherFilters(noFilters)).toBe(false);
    expect(hasActiveGetTogetherFilters({ ...noFilters, query: '   ' })).toBe(false);
    expect(hasActiveGetTogetherFilters({ ...noFilters, query: 'asado' })).toBe(true);
    expect(hasActiveGetTogetherFilters({ ...noFilters, month: '2026-01' })).toBe(true);
    expect(hasActiveGetTogetherFilters({ ...noFilters, participantIds: ['ana'] })).toBe(true);
  });
});

describe('filterGetTogethers', () => {
  test('returns every item when no filters are applied', () => {
    expect(filterGetTogethers(items, noFilters)).toEqual(items);
  });

  test('filters by name ignoring case and accents', () => {
    expect(filterGetTogethers(items, { ...noFilters, query: 'ASADO' })).toEqual([items[0]]);
    expect(filterGetTogethers(items, { ...noFilters, query: 'futbol' })).toEqual([items[1]]);
    expect(filterGetTogethers(items, { ...noFilters, query: 'noche' })).toEqual([]);
  });

  test('filters by month key', () => {
    expect(filterGetTogethers(items, { ...noFilters, month: '2026-01' })).toEqual([
      items[0],
      items[1],
    ]);
    expect(filterGetTogethers(items, { ...noFilters, month: '2025-12' })).toEqual([]);
  });

  test('filters by participants requiring all selected ones', () => {
    expect(filterGetTogethers(items, { ...noFilters, participantIds: ['ana'] })).toEqual([
      items[0],
      items[1],
    ]);
    expect(filterGetTogethers(items, { ...noFilters, participantIds: ['ana', 'beto'] })).toEqual([
      items[0],
    ]);
    expect(filterGetTogethers(items, { ...noFilters, participantIds: ['carlos', 'ana'] })).toEqual([
      items[1],
    ]);
    expect(filterGetTogethers(items, { ...noFilters, participantIds: ['nadie'] })).toEqual([]);
  });

  test('combines name, month and participant filters', () => {
    expect(
      filterGetTogethers(items, {
        query: 'futbol',
        month: '2026-01',
        participantIds: ['carlos'],
      })
    ).toEqual([items[1]]);
    expect(
      filterGetTogethers(items, {
        query: 'futbol',
        month: '2026-02',
        participantIds: ['carlos'],
      })
    ).toEqual([]);
  });
});
