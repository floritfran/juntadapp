import type { SQLiteDatabase } from 'expo-sqlite';

import { TrucoRound } from '../../domain/games/truco/truco-types';
import { MatchId } from '../../domain/games/game-types';
import { newId } from '../id';

interface TrucoRoundRow {
  round_number: number;
  team1_points: number;
  team2_points: number;
}

function rowToTrucoRound(row: TrucoRoundRow): TrucoRound {
  return {
    roundNumber: row.round_number,
    team1Points: row.team1_points,
    team2Points: row.team2_points,
  };
}

export async function listTrucoRounds(db: SQLiteDatabase, matchId: MatchId): Promise<TrucoRound[]> {
  const rows = await db.getAllAsync<TrucoRoundRow>(
    'SELECT round_number, team1_points, team2_points FROM truco_rounds WHERE match_id = ? ORDER BY round_number ASC',
    matchId
  );
  return rows.map(rowToTrucoRound);
}

export async function addTrucoRound(
  db: SQLiteDatabase,
  input: { matchId: MatchId; team1Points: number; team2Points: number }
): Promise<TrucoRound> {
  const last = await db.getFirstAsync<{ last_round: number | null }>(
    'SELECT MAX(round_number) AS last_round FROM truco_rounds WHERE match_id = ?',
    input.matchId
  );
  const roundNumber = (last?.last_round ?? 0) + 1;
  await db.runAsync(
    `INSERT INTO truco_rounds (id, match_id, round_number, team1_points, team2_points, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    newId(),
    input.matchId,
    roundNumber,
    input.team1Points,
    input.team2Points,
    Date.now()
  );
  return { roundNumber, team1Points: input.team1Points, team2Points: input.team2Points };
}

export async function removeLastTrucoRound(db: SQLiteDatabase, matchId: MatchId): Promise<void> {
  await db.runAsync(
    `DELETE FROM truco_rounds
      WHERE match_id = ?
        AND round_number = (SELECT MAX(round_number) FROM truco_rounds WHERE match_id = ?)`,
    matchId,
    matchId
  );
}
