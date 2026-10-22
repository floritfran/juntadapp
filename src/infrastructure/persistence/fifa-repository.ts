import type { SQLiteDatabase } from 'expo-sqlite';

import { MatchId, PersonId } from '../../domain/games/game-types';
import {
  FifaGame,
  FifaMode,
  FifaResult,
} from '../../domain/games/fifa/fifa-types';
import { cupBracketPlan, leagueRoundPlan } from '../../domain/games/fifa/fifa-scorer';
import { newId } from '../id';

export interface FifaTournament {
  mode: FifaMode;
  games: FifaGame[];
}

export interface FifaAdvance {
  round: number;
  slot: number;
  position: 1 | 2;
  winnerId: PersonId;
}

interface FifaTournamentRow {
  mode: string;
}

interface FifaGameRow {
  id: string;
  round: number;
  slot: number;
  player1_id: string | null;
  player2_id: string | null;
  score1: number | null;
  score2: number | null;
  penalty_winner_id: string | null;
  played_at: number | null;
}

function rowToFifaGame(row: FifaGameRow): FifaGame {
  return {
    id: row.id,
    round: row.round,
    slot: row.slot,
    player1Id: row.player1_id,
    player2Id: row.player2_id,
    score1: row.score1,
    score2: row.score2,
    penaltyWinnerId: row.penalty_winner_id,
    playedAt: row.played_at != null ? new Date(row.played_at) : null,
  };
}

export async function getFifaTournament(
  db: SQLiteDatabase,
  matchId: MatchId
): Promise<FifaTournament | null> {
  const tournament = await db.getFirstAsync<FifaTournamentRow>(
    'SELECT mode FROM fifa_tournaments WHERE match_id = ?',
    matchId
  );
  if (!tournament) return null;
  const rows = await db.getAllAsync<FifaGameRow>(
    `SELECT id, round, slot, player1_id, player2_id, score1, score2,
            penalty_winner_id, played_at
       FROM fifa_games
      WHERE match_id = ?
      ORDER BY round ASC, slot ASC`,
    matchId
  );
  return {
    mode: tournament.mode as FifaMode,
    games: rows.map(rowToFifaGame),
  };
}

async function insertGames(
  db: SQLiteDatabase,
  matchId: MatchId,
  plans: ReturnType<typeof leagueRoundPlan>
): Promise<void> {
  for (const plan of plans) {
    await db.runAsync(
      `INSERT INTO fifa_games
         (id, match_id, round, slot, player1_id, player2_id, score1, score2, penalty_winner_id, played_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`,
      newId(),
      matchId,
      plan.round,
      plan.slot,
      plan.player1Id,
      plan.player2Id
    );
  }
}

export async function createFifaTournament(
  db: SQLiteDatabase,
  input: { matchId: MatchId; mode: FifaMode; playerIds: PersonId[] }
): Promise<FifaTournament> {
  const plans =
    input.mode === 'league'
      ? leagueRoundPlan(input.playerIds, 0)
      : cupBracketPlan(input.playerIds);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO fifa_tournaments (match_id, mode, created_at) VALUES (?, ?, ?)',
      input.matchId,
      input.mode,
      Date.now()
    );
    await insertGames(db, input.matchId, plans);
  });

  const created = await getFifaTournament(db, input.matchId);
  if (!created) throw new Error('failed to create fifa tournament');
  return created;
}

export async function appendFifaLeagueRound(
  db: SQLiteDatabase,
  input: { matchId: MatchId; playerIds: PersonId[]; roundIndex: number }
): Promise<void> {
  const plans = leagueRoundPlan(input.playerIds, input.roundIndex);
  await insertGames(db, input.matchId, plans);
}

export async function saveFifaResult(
  db: SQLiteDatabase,
  input: {
    matchId: MatchId;
    gameId: string;
    result: FifaResult;
    advance?: FifaAdvance | null;
  }
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE fifa_games
          SET score1 = ?, score2 = ?, penalty_winner_id = ?, played_at = ?
        WHERE id = ? AND match_id = ?`,
      input.result.score1,
      input.result.score2,
      input.result.penaltyWinnerId ?? null,
      Date.now(),
      input.gameId,
      input.matchId
    );

    if (input.advance) {
      const column = input.advance.position === 1 ? 'player1_id' : 'player2_id';
      await db.runAsync(
        `UPDATE fifa_games
            SET ${column} = ?
          WHERE match_id = ? AND round = ? AND slot = ?`,
        input.advance.winnerId,
        input.matchId,
        input.advance.round,
        input.advance.slot
      );
    }
  });
}
