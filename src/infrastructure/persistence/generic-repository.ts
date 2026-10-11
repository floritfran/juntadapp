import type { SQLiteDatabase } from 'expo-sqlite';

import { MatchId, PersonId } from '../../domain/games/game-types';
import { GenericAdjustment } from '../../domain/games/generic/generic-types';
import { newId } from '../id';

interface GenericAdjustmentRow {
  id: string;
  person_id: string;
  points: number;
  created_at: number;
}

function rowToGenericAdjustment(row: GenericAdjustmentRow): GenericAdjustment {
  return {
    id: row.id,
    personId: row.person_id,
    points: row.points,
    createdAt: new Date(row.created_at),
  };
}

export async function listGenericAdjustments(
  db: SQLiteDatabase,
  matchId: MatchId
): Promise<GenericAdjustment[]> {
  const rows = await db.getAllAsync<GenericAdjustmentRow>(
    `SELECT id, person_id, points, created_at
       FROM generic_adjustments
      WHERE match_id = ?
      ORDER BY created_at ASC, rowid ASC`,
    matchId
  );
  return rows.map(rowToGenericAdjustment);
}

export async function addGenericAdjustment(
  db: SQLiteDatabase,
  input: { matchId: MatchId; personId: PersonId; points: number }
): Promise<void> {
  await db.runAsync(
    `INSERT INTO generic_adjustments (id, match_id, person_id, points, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    newId(),
    input.matchId,
    input.personId,
    input.points,
    Date.now()
  );
}

export async function removeLastGenericAdjustment(db: SQLiteDatabase, matchId: MatchId): Promise<void> {
  await db.runAsync(
    `DELETE FROM generic_adjustments
      WHERE rowid = (SELECT rowid
                       FROM generic_adjustments
                      WHERE match_id = ?
                      ORDER BY created_at DESC, rowid DESC
                      LIMIT 1)`,
    matchId
  );
}