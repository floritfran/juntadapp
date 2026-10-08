import type { SQLiteDatabase } from 'expo-sqlite';

import { MatchId } from '../../domain/games/game-types';
import { SkullKingRoundEntry } from '../../domain/games/skull-king/skull-king-types';

interface SkullKingRoundRow {
  round_number: number;
  person_id: string;
  bid: number;
  tricks: number;
  bonus: number;
}

function rowToSkullKingRound(row: SkullKingRoundRow): SkullKingRoundEntry {
  return {
    round: row.round_number,
    personId: row.person_id,
    bid: row.bid,
    tricks: row.tricks,
    bonus: row.bonus,
  };
}

export async function listSkullKingEntries(db: SQLiteDatabase, matchId: MatchId): Promise<SkullKingRoundEntry[]> {
  const rows = await db.getAllAsync<SkullKingRoundRow>(
    'SELECT round_number, person_id, bid, tricks, bonus FROM skull_king_rounds WHERE match_id = ? ORDER BY round_number ASC',
    matchId
  );
  return rows.map(rowToSkullKingRound);
}

export async function saveSkullKingRound(
  db: SQLiteDatabase,
  matchId: MatchId,
  entries: readonly SkullKingRoundEntry[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const entry of entries) {
      await db.runAsync(
        `INSERT INTO skull_king_rounds (match_id, round_number, person_id, bid, tricks, bonus, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (match_id, round_number, person_id)
         DO UPDATE SET bid = excluded.bid, tricks = excluded.tricks, bonus = excluded.bonus`,
        matchId,
        entry.round,
        entry.personId,
        entry.bid,
        entry.tricks,
        entry.bonus,
        Date.now()
      );
    }
  });
}

export async function removeLastSkullKingRound(db: SQLiteDatabase, matchId: MatchId): Promise<void> {
  await db.runAsync(
    `DELETE FROM skull_king_rounds
      WHERE match_id = ?
        AND round_number = (SELECT MAX(round_number) FROM skull_king_rounds WHERE match_id = ?)`,
    matchId,
    matchId
  );
}
