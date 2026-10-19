import type { SQLiteDatabase } from 'expo-sqlite';

import { Settlement, SettlementId } from '../../domain/expenses/expense-types';
import { GetTogetherId } from '../../domain/get-togethers/get-together-types';
import { PersonId } from '../../domain/people/person-types';
import { newId } from '../id';

interface SettlementRow {
  id: string;
  get_together_id: string;
  from_id: string;
  to_id: string;
  amount_int: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

function rowToSettlement(row: SettlementRow): Settlement {
  return {
    id: row.id,
    getTogetherId: row.get_together_id,
    fromId: row.from_id,
    toId: row.to_id,
    amountInt: row.amount_int,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at != null ? new Date(row.deleted_at) : null,
  };
}

export async function listSettlements(
  db: SQLiteDatabase,
  getTogetherId: GetTogetherId
): Promise<Settlement[]> {
  const rows = await db.getAllAsync<SettlementRow>(
    `SELECT * FROM settlements
      WHERE get_together_id = ? AND deleted_at IS NULL
      ORDER BY created_at ASC, id ASC`,
    getTogetherId
  );
  return rows.map(rowToSettlement);
}

export async function createSettlement(
  db: SQLiteDatabase,
  input: {
    getTogetherId: GetTogetherId;
    fromId: PersonId;
    toId: PersonId;
    amountInt: number;
  }
): Promise<Settlement> {
  const now = Date.now();
  const settlement: Settlement = {
    id: newId(),
    getTogetherId: input.getTogetherId,
    fromId: input.fromId,
    toId: input.toId,
    amountInt: input.amountInt,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    deletedAt: null,
  };
  await db.runAsync(
    `INSERT INTO settlements (id, get_together_id, from_id, to_id, amount_int, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    settlement.id,
    settlement.getTogetherId,
    settlement.fromId,
    settlement.toId,
    settlement.amountInt,
    now,
    now
  );
  return settlement;
}

export async function softDeleteSettlement(db: SQLiteDatabase, id: SettlementId): Promise<void> {
  const now = Date.now();
  await db.runAsync('UPDATE settlements SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
}
