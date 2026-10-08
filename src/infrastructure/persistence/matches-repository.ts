import type { SQLiteDatabase } from 'expo-sqlite';

import {
  GameId,
  Match,
  MatchId,
  MatchPlayer,
  MatchStatus,
  TrucoTeam,
  TrucoTeamSize,
} from '../../domain/games/game-types';
import { GetTogetherId } from '../../domain/get-togethers/get-together-types';
import { newId } from '../id';

interface MatchRow {
  id: string;
  get_together_id: string;
  game: string;
  status: string;
  team_size: number | null;
  created_at: number;
  finished_at: number | null;
}

interface MatchPlayerRow {
  match_id: string;
  person_id: string;
  team: number | null;
  position: number;
}

function rowToMatch(row: MatchRow, players: MatchPlayer[]): Match {
  return {
    id: row.id,
    getTogetherId: row.get_together_id,
    game: row.game as GameId,
    status: row.status as MatchStatus,
    teamSize: (row.team_size ?? null) as TrucoTeamSize | null,
    players,
    createdAt: new Date(row.created_at),
    finishedAt: row.finished_at != null ? new Date(row.finished_at) : null,
  };
}

async function loadPlayers(db: SQLiteDatabase, matchIds: MatchId[]): Promise<Map<MatchId, MatchPlayer[]>> {
  const byMatch = new Map<MatchId, MatchPlayer[]>();
  if (matchIds.length === 0) return byMatch;
  const placeholders = matchIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<MatchPlayerRow>(
    `SELECT * FROM match_players WHERE match_id IN (${placeholders}) ORDER BY match_id ASC, position ASC`,
    ...matchIds
  );
  for (const row of rows) {
    const list = byMatch.get(row.match_id) ?? [];
    list.push({
      personId: row.person_id,
      position: row.position,
      team: (row.team ?? null) as TrucoTeam | null,
    });
    byMatch.set(row.match_id, list);
  }
  return byMatch;
}

export async function listMatches(db: SQLiteDatabase, getTogetherId: GetTogetherId): Promise<Match[]> {
  const rows = await db.getAllAsync<MatchRow>(
    `SELECT * FROM matches WHERE get_together_id = ? ORDER BY created_at DESC, id ASC`,
    getTogetherId
  );
  const playersByMatch = await loadPlayers(db, rows.map((row) => row.id));
  return rows.map((row) => rowToMatch(row, playersByMatch.get(row.id) ?? []));
}

export async function getMatch(db: SQLiteDatabase, matchId: MatchId): Promise<Match | null> {
  const row = await db.getFirstAsync<MatchRow>('SELECT * FROM matches WHERE id = ?', matchId);
  if (!row) return null;
  const playersByMatch = await loadPlayers(db, [matchId]);
  return rowToMatch(row, playersByMatch.get(matchId) ?? []);
}

export async function createMatch(
  db: SQLiteDatabase,
  input: {
    getTogetherId: GetTogetherId;
    game: GameId;
    teamSize: TrucoTeamSize | null;
    players: { personId: MatchPlayer['personId']; team: TrucoTeam | null }[];
  }
): Promise<Match> {
  const now = Date.now();
  const matchId = newId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO matches (id, get_together_id, game, status, team_size, created_at, finished_at)
       VALUES (?, ?, ?, 'active', ?, ?, NULL)`,
      matchId,
      input.getTogetherId,
      input.game,
      input.teamSize,
      now
    );
    for (let position = 0; position < input.players.length; position++) {
      const player = input.players[position];
      await db.runAsync(
        'INSERT INTO match_players (match_id, person_id, team, position) VALUES (?, ?, ?, ?)',
        matchId,
        player.personId,
        player.team,
        position
      );
    }
  });
  const created = await getMatch(db, matchId);
  if (!created) throw new Error('failed to create match');
  return created;
}

export async function finishMatch(db: SQLiteDatabase, matchId: MatchId): Promise<void> {
  await db.runAsync("UPDATE matches SET status = 'finished', finished_at = ? WHERE id = ?", Date.now(), matchId);
}

export async function reopenMatch(db: SQLiteDatabase, matchId: MatchId): Promise<void> {
  await db.runAsync("UPDATE matches SET status = 'active', finished_at = NULL WHERE id = ?", matchId);
}

export async function deleteMatch(db: SQLiteDatabase, matchId: MatchId): Promise<void> {
  await db.runAsync('DELETE FROM matches WHERE id = ?', matchId);
}
