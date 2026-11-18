import { Expense } from '../expenses/expense-types';
import { PersonId } from '../people/person-types';

export function sameParticipants(a: PersonId[], b: PersonId[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a);
  return b.every((id) => ids.has(id));
}

export function findExpensePayers(expenses: Expense[]): Set<PersonId> {
  const ids = new Set<PersonId>();
  for (const expense of expenses) {
    if (expense.deletedAt) continue;
    ids.add(expense.payerId);
  }
  return ids;
}

export function reassignExpensesToParticipants(
  expenses: Expense[],
  participantIds: PersonId[]
): Expense[] {
  return expenses
    .filter((expense) => !expense.deletedAt)
    .map((expense) => ({
      ...expense,
      participantIds: [...participantIds],
      splitMode: 'equal' as const,
      splitValues: null,
    }));
}
