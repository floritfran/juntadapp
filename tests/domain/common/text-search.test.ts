import {
  matchesQuery,
  normalizeForSearch,
} from '../../../src/domain/common/text-search';

describe('normalizeForSearch', () => {
  test('lowercases and strips accents', () => {
    expect(normalizeForSearch('FACUNDO')).toBe('facundo');
    expect(normalizeForSearch('José María')).toBe('jose maria');
    expect(normalizeForSearch('Ñandú')).toBe('nandu');
  });

  test('keeps plain text unchanged', () => {
    expect(normalizeForSearch('juan 123')).toBe('juan 123');
  });
});

describe('matchesQuery', () => {
  test('empty or blank query matches everything', () => {
    expect(matchesQuery('Facundo', '')).toBe(true);
    expect(matchesQuery('Facundo', '   ')).toBe(true);
  });

  test('is case-insensitive', () => {
    expect(matchesQuery('FACUNDO', 'facu')).toBe(true);
    expect(matchesQuery('facundo', 'FACU')).toBe(true);
  });

  test('ignores accents in text and query', () => {
    expect(matchesQuery('FACUNDO', 'facu')).toBe(true);
    expect(matchesQuery('José', 'jose')).toBe(true);
    expect(matchesQuery('Jose', 'josé')).toBe(true);
  });

  test('matches any substring', () => {
    expect(matchesQuery('Juan Pedro', 'pedro')).toBe(true);
    expect(matchesQuery('Juan Pedro', 'juan pe')).toBe(true);
    expect(matchesQuery('Juan Pedro', 'pedrito')).toBe(false);
  });

  test('does not match unrelated names', () => {
    expect(matchesQuery('Ana', 'facu')).toBe(false);
  });
});
