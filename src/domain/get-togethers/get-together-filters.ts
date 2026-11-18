import { matchesQuery } from '../common/text-search';
import { PersonId } from '../people/person-types';

export interface GetTogetherFilterable {
  name: string;
  date: Date;
  participantIds: PersonId[];
}

export interface GetTogetherFilters {
  query: string;
  month: string | null;
  participantIds: PersonId[];
}

export function getMonthKey(date: Date): string {
  return monthKeyFrom(date.getFullYear(), date.getMonth() + 1);
}

export function monthKeyFrom(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonthKey(monthKey: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthKey);
  if (match === null) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function hasActiveGetTogetherFilters(filters: GetTogetherFilters): boolean {
  return filters.query.trim() !== '' || filters.month !== null || filters.participantIds.length > 0;
}

export function filterGetTogethers<T extends GetTogetherFilterable>(
  items: T[],
  filters: GetTogetherFilters
): T[] {
  return items.filter((item) => {
    if (!matchesQuery(item.name, filters.query)) return false;
    if (filters.month !== null && getMonthKey(item.date) !== filters.month) return false;
    return filters.participantIds.every((personId) => item.participantIds.includes(personId));
  });
}
