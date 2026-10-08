import type { SQLiteDatabase } from 'expo-sqlite';

import { MatchId, PersonId } from '../../domain/games/game-types';
import { GeneralaBox, GeneralaEntry } from '../../domain/games/generala/generala-types';

export interface GeneralaPlayerEntry extends GeneralaEntry {
  personId: PersonId;
}

interface GeneralaEntryRow {
  person_id: string;
  box: string;
  points: number;
  tachado: number;
}

function rowToGeneralaPlayerEntry(row: GeneralaEntryRow): GeneralaPlayerEntry {
  return {
    personId: row.person_id,
    box: row.box as GeneralaBox,
    points: row.points,
    tachado: row.tachado === 1,
  };
}

export async function listGeneralaEntries(db: SQLiteDatabase, matchId: MatchId): Promise<GeneralaPlayerEntry[]> {
  const rows = await db.getAllAsync<GeneralaEntryRow>(
    'SELECT person_id, box, points, tachado FROM generala_entries WHERE match_id = ? ORDER BY created_at ASC',
    matchId
  );
  return rows.map(rowToGeneralaPlayerEntry);
}

export async function addGeneralaEntry(
  db: SQLiteDatabase,
  input: { matchId: MatchId; personId: PersonId; box: GeneralaBox; points: number; tachado: boolean }
): Promise<void> {
  await db.runAsync('DELETE FROM generala_entries WHERE match_id = ? AND person_id = ? AND box = ?', input.matchId, input.personId, input.box);
  await db.runAsync(
    `INSERT INTO generala_entries (match_id, person_id, box, points, tachado, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    input.matchId,
    input.personId,
    input.box,
    input.tachado ? 0 : input.points,
    input.tachado ? 1 : 0,
    Date.now()
  );
}
