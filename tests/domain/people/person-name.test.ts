import { findPersonWithName } from '../../../src/domain/people/person-name';

const people = [
  { id: '1', name: 'Juan' },
  { id: '2', name: 'José María' },
];

describe('findPersonWithName', () => {
  test('finds an existing person by exact name', () => {
    expect(findPersonWithName(people, 'Juan')).toEqual(people[0]);
  });

  test('is case-insensitive', () => {
    expect(findPersonWithName(people, 'juan')).toEqual(people[0]);
    expect(findPersonWithName(people, 'JUAN')).toEqual(people[0]);
  });

  test('ignores accents', () => {
    expect(findPersonWithName(people, 'jose maria')).toEqual(people[1]);
    expect(findPersonWithName(people, 'José Maria')).toEqual(people[1]);
  });

  test('trims the candidate name', () => {
    expect(findPersonWithName(people, '  Juan  ')).toEqual(people[0]);
  });

  test('skips the excluded person when editing', () => {
    expect(findPersonWithName(people, 'Juan', '1')).toBeUndefined();
    expect(findPersonWithName(people, 'juan', '1')).toBeUndefined();
  });

  test('returns undefined when there is no match', () => {
    expect(findPersonWithName(people, 'Pedro')).toBeUndefined();
  });

  test('ignores blank names', () => {
    expect(findPersonWithName(people, '   ')).toBeUndefined();
  });
});
