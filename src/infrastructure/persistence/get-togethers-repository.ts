import type { SQLiteDatabase } from 'expo-sqlite';

import { MoneyInt } from '../../domain/common/Money';
import {
  GetTogether,
  GetTogetherId,
  GetTogetherStatus,
} from '../../domain/get-togethers/get-together-types';
import { PersonId } from '../../domain/people/person-types';
import { newId } from '../id';
import { CASUAL_GET_TOGETHER_ID } from './migrations';

export interface GetTogetherSummary extends GetTogether {
  totalSpent: MoneyInt;
}

interface GetTogetherRow {
  id: string;
  name: string;
  date: number;
  status: string;
  closed_at: number | null;
  created_at: number;
  updated_at: number;
  total_spent?: number;
}

interface ParticipantLinkRow {
  get_together_id: string;
  person_id: string;
}

function rowToGetTogether(row: GetTogetherRow, participantIds: PersonId[]): GetTogether {
  return {
    id: row.id,
    name: row.name,
    date: new Date(row.date),
    status: (row.status === 'closed' ? 'closed' : 'active') as GetTogetherStatus,
    closedAt: row.closed_at != null ? new Date(row.closed_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    participantIds,
  };
}

async function getParticipantIdsByGetTogether(
  db: SQLiteDatabase
): Promise<Map<GetTogetherId, PersonId[]>> {
  const links = await db.getAllAsync<ParticipantLinkRow>(
    'SELECT get_together_id, person_id FROM get_together_people ORDER BY position ASC'
  );
  const map = new Map<GetTogetherId, PersonId[]>();
  for (const link of links) {
    const list = map.get(link.get_together_id) ?? [];
    list.push(link.person_id);
    map.set(link.get_together_id, list);
  }
  return map;
}

export async function listGetTogethers(db: SQLiteDatabase): Promise<GetTogetherSummary[]> {
  const rows = await db.getAllAsync<GetTogetherRow>(
    `SELECT gt.*,
            COALESCE((SELECT SUM(e.amount_int) FROM expenses e
                       WHERE e.get_together_id = gt.id AND e.deleted_at IS NULL), 0) AS total_spent
       FROM get_togethers gt
      WHERE gt.id <> ?
      ORDER BY gt.date DESC, gt.created_at DESC`,
    CASUAL_GET_TOGETHER_ID
  );
  const participants = await getParticipantIdsByGetTogether(db);
  return rows.map((row) => ({
    ...rowToGetTogether(row, participants.get(row.id) ?? []),
    totalSpent: row.total_spent ?? 0,
  }));
}

export async function getGetTogether(
  db: SQLiteDatabase,
  id: GetTogetherId
): Promise<GetTogether | null> {
  const row = await db.getFirstAsync<GetTogetherRow>('SELECT * FROM get_togethers WHERE id = ?', id);
  if (!row) return null;
  const links = await db.getAllAsync<ParticipantLinkRow>(
    'SELECT get_together_id, person_id FROM get_together_people WHERE get_together_id = ? ORDER BY position ASC',
    id
  );
  return rowToGetTogether(
    row,
    links.map((link) => link.person_id)
  );
}

export async function updateGetTogether(
  db: SQLiteDatabase,
  id: GetTogetherId,
  input: { name: string; participantIds: PersonId[]; updateExpenses: boolean }
): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE get_togethers SET name = ?, updated_at = ? WHERE id = ?',
      input.name.trim(),
      now,
      id
    );
    await db.runAsync('DELETE FROM get_together_people WHERE get_together_id = ?', id);
    for (let position = 0; position < input.participantIds.length; position++) {
      await db.runAsync(
        'INSERT INTO get_together_people (get_together_id, person_id, position) VALUES (?, ?, ?)',
        id,
        input.participantIds[position],
        position
      );
    }
    if (!input.updateExpenses) return;
    const expenses = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM expenses WHERE get_together_id = ? AND deleted_at IS NULL',
      id
    );
    for (const expense of expenses) {
      await db.runAsync('DELETE FROM expense_participants WHERE expense_id = ?', expense.id);
      for (let position = 0; position < input.participantIds.length; position++) {
        await db.runAsync(
          'INSERT INTO expense_participants (expense_id, person_id, position, split_value) VALUES (?, ?, ?, NULL)',
          expense.id,
          input.participantIds[position],
          position
        );
      }
      await db.runAsync(
        "UPDATE expenses SET split_mode = 'equal', updated_at = ? WHERE id = ?",
        now,
        expense.id
      );
    }
  });
}

async function setGetTogetherStatus(
  db: SQLiteDatabase,
  id: GetTogetherId,
  status: GetTogetherStatus
): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `UPDATE get_togethers
        SET status = ?, closed_at = ?, updated_at = ?
      WHERE id = ? AND id <> ?`,
    status,
    status === 'closed' ? now : null,
    now,
    id,
    CASUAL_GET_TOGETHER_ID
  );
}

export async function closeGetTogether(db: SQLiteDatabase, id: GetTogetherId): Promise<void> {
  await setGetTogetherStatus(db, id, 'closed');
}

export async function reopenGetTogether(db: SQLiteDatabase, id: GetTogetherId): Promise<void> {
  await setGetTogetherStatus(db, id, 'active');
}

export async function deleteGetTogether(
  db: SQLiteDatabase,
  id: GetTogetherId
): Promise<void> {
  await db.runAsync(
    'DELETE FROM get_togethers WHERE id = ? AND id <> ?',
    id,
    CASUAL_GET_TOGETHER_ID
  );
}

export async function createGetTogether(
  db: SQLiteDatabase,
  input: { name: string; date: Date; participantIds: PersonId[] }
): Promise<GetTogether> {
  const now = Date.now();
  const getTogether: GetTogether = {
    id: newId(),
    name: input.name.trim(),
    date: input.date,
    status: 'active',
    closedAt: null,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    participantIds: input.participantIds,
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO get_togethers (id, name, date, status, closed_at, created_at, updated_at)
       VALUES (?, ?, ?, 'active', NULL, ?, ?)`,
      getTogether.id,
      getTogether.name,
      getTogether.date.getTime(),
      now,
      now
    );
    for (let position = 0; position < getTogether.participantIds.length; position++) {
      await db.runAsync(
        'INSERT INTO get_together_people (get_together_id, person_id, position) VALUES (?, ?, ?)',
        getTogether.id,
        getTogether.participantIds[position],
        position
      );
    }
  });
  return getTogether;
}
