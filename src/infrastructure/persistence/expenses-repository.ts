import type { SQLiteDatabase } from 'expo-sqlite';

import { Expense, ExpenseId, SplitMode, SplitValues } from '../../domain/expenses/expense-types';
import { GetTogetherId } from '../../domain/get-togethers/get-together-types';
import { PersonId } from '../../domain/people/person-types';
import { newId } from '../id';

interface ExpenseRow {
  id: string;
  get_together_id: string;
  payer_id: string;
  description: string;
  amount_int: number;
  split_mode: SplitMode;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface ParticipantLinkRow {
  expense_id: string;
  person_id: string;
  split_value: number | null;
}

function rowToExpense(row: ExpenseRow, links: ParticipantLinkRow[]): Expense {
  const splitMode = row.split_mode;
  return {
    id: row.id,
    getTogetherId: row.get_together_id,
    payerId: row.payer_id,
    description: row.description,
    amountInt: row.amount_int,
    participantIds: links.map((link) => link.person_id),
    splitMode,
    splitValues:
      splitMode === 'equal'
        ? null
        : Object.fromEntries(
            links.map((link) => [link.person_id, link.split_value ?? 0])
          ),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at != null ? new Date(row.deleted_at) : null,
  };
}

export async function listExpenses(
  db: SQLiteDatabase,
  getTogetherId: GetTogetherId
): Promise<Expense[]> {
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT * FROM expenses
      WHERE get_together_id = ? AND deleted_at IS NULL
      ORDER BY created_at ASC, id ASC`,
    getTogetherId
  );
  const links = await db.getAllAsync<ParticipantLinkRow>(
    `SELECT ep.expense_id, ep.person_id, ep.split_value
       FROM expense_participants ep
       JOIN expenses e ON e.id = ep.expense_id
      WHERE e.get_together_id = ? AND e.deleted_at IS NULL
      ORDER BY ep.position ASC`,
    getTogetherId
  );
  const byExpense = new Map<ExpenseId, ParticipantLinkRow[]>();
  for (const link of links) {
    const list = byExpense.get(link.expense_id) ?? [];
    list.push(link);
    byExpense.set(link.expense_id, list);
  }
  return rows.map((row) => rowToExpense(row, byExpense.get(row.id) ?? []));
}

export async function createExpense(
  db: SQLiteDatabase,
  input: {
    getTogetherId: GetTogetherId;
    payerId: PersonId;
    description: string;
    amountInt: number;
    participantIds: PersonId[];
    splitMode?: SplitMode;
    splitValues?: SplitValues | null;
  }
): Promise<Expense> {
  const now = Date.now();
  const splitMode = input.splitMode ?? 'equal';
  const splitValues = splitMode === 'equal' ? null : input.splitValues ?? null;
  const expense: Expense = {
    id: newId(),
    getTogetherId: input.getTogetherId,
    payerId: input.payerId,
    description: input.description.trim(),
    amountInt: input.amountInt,
    participantIds: input.participantIds,
    splitMode,
    splitValues,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    deletedAt: null,
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO expenses (id, get_together_id, payer_id, description, amount_int, split_mode, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      expense.id,
      expense.getTogetherId,
      expense.payerId,
      expense.description,
      expense.amountInt,
      splitMode,
      now,
      now
    );
    for (let position = 0; position < expense.participantIds.length; position++) {
      const personId = expense.participantIds[position];
      await db.runAsync(
        'INSERT INTO expense_participants (expense_id, person_id, position, split_value) VALUES (?, ?, ?, ?)',
        expense.id,
        personId,
        position,
        splitValues?.[personId] ?? null
      );
    }
  });
  return expense;
}

export async function getExpense(db: SQLiteDatabase, id: ExpenseId): Promise<Expense | null> {
  const row = await db.getFirstAsync<ExpenseRow>(
    'SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL',
    id
  );
  if (!row) return null;
  const links = await db.getAllAsync<ParticipantLinkRow>(
    'SELECT expense_id, person_id, split_value FROM expense_participants WHERE expense_id = ? ORDER BY position ASC',
    id
  );
  return rowToExpense(row, links);
}

export async function updateExpense(
  db: SQLiteDatabase,
  id: ExpenseId,
  input: {
    payerId: PersonId;
    description: string;
    amountInt: number;
    participantIds: PersonId[];
    splitMode?: SplitMode;
    splitValues?: SplitValues | null;
  }
): Promise<void> {
  const now = Date.now();
  const splitMode = input.splitMode ?? 'equal';
  const splitValues = splitMode === 'equal' ? null : input.splitValues ?? null;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE expenses
          SET payer_id = ?, description = ?, amount_int = ?, split_mode = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL`,
      input.payerId,
      input.description.trim(),
      input.amountInt,
      splitMode,
      now,
      id
    );
    await db.runAsync('DELETE FROM expense_participants WHERE expense_id = ?', id);
    for (let position = 0; position < input.participantIds.length; position++) {
      const personId = input.participantIds[position];
      await db.runAsync(
        'INSERT INTO expense_participants (expense_id, person_id, position, split_value) VALUES (?, ?, ?, ?)',
        id,
        personId,
        position,
        splitValues?.[personId] ?? null
      );
    }
  });
}

export async function softDeleteExpense(db: SQLiteDatabase, id: ExpenseId): Promise<void> {
  const now = Date.now();
  await db.runAsync('UPDATE expenses SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
}
