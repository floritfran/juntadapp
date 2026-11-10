import { normalizeForSearch } from '../common/text-search';

interface NamedPerson {
  id: string;
  name: string;
}

export function findPersonWithName<T extends NamedPerson>(
  people: T[],
  name: string,
  excludeId?: string
): T | undefined {
  const normalized = normalizeForSearch(name.trim());
  if (normalized === '') return undefined;
  return people.find(
    (person) => person.id !== excludeId && normalizeForSearch(person.name.trim()) === normalized
  );
}
