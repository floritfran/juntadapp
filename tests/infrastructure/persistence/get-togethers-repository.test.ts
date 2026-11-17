/** @jest-environment node */

import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

import { deleteGetTogether } from '@/infrastructure/persistence/get-togethers-repository';
import { CASUAL_GET_TOGETHER_ID, migrateDatabase } from '@/infrastructure/persistence/migrations';

type SqlParam = string | number | bigint | Uint8Array | null;

function openMemoryDatabase(): { sqlite: DatabaseSync; db: SQLiteDatabase } {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => {
      sqlite.exec(sql);
    },
    getFirstAsync: async <T>(sql: string, ...params: SqlParam[]) =>
      sqlite.prepare(sql).get(...params) as T | undefined,
    getAllAsync: async <T>(sql: string, ...params: SqlParam[]) =>
      sqlite.prepare(sql).all(...params) as T[],
    runAsync: async (sql: string, ...params: SqlParam[]) => {
      sqlite.prepare(sql).run(...params);
    },
    withTransactionAsync: async (work: () => Promise<void>) => {
      sqlite.exec('BEGIN');
      try {
        await work();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;
  return { sqlite, db };
}

function seed(sqlite: DatabaseSync): void {
  const now = Date.now();
  const rows: [string, SqlParam[]][] = [
    ['INSERT INTO people (id, name, deleted_at, created_at) VALUES (?, ?, NULL, ?)', ['p1', 'Ana', now]],
    ['INSERT INTO people (id, name, deleted_at, created_at) VALUES (?, ?, NULL, ?)', ['p2', 'Beto', now]],
    [
      'INSERT INTO get_togethers (id, name, date, status, closed_at, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)',
      ['gt1', 'Juntada', now, 'active', now, now],
    ],
    ['INSERT INTO get_together_people (get_together_id, person_id, position) VALUES (?, ?, ?)', ['gt1', 'p1', 0]],
    ['INSERT INTO get_together_people (get_together_id, person_id, position) VALUES (?, ?, ?)', ['gt1', 'p2', 1]],
    [
      'INSERT INTO expenses (id, get_together_id, payer_id, description, amount_int, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
      ['e1', 'gt1', 'p1', 'Comida', 1000, now, now],
    ],
    ['INSERT INTO expense_participants (expense_id, person_id, position) VALUES (?, ?, ?)', ['e1', 'p1', 0]],
    ['INSERT INTO expense_participants (expense_id, person_id, position) VALUES (?, ?, ?)', ['e1', 'p2', 1]],
    [
      'INSERT INTO settlements (id, get_together_id, from_id, to_id, amount_int, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
      ['s1', 'gt1', 'p2', 'p1', 500, now, now],
    ],
    [
      'INSERT INTO matches (id, get_together_id, game, status, team_size, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['m1', 'gt1', 'truco', 'finished', 1, now, now],
    ],
    [
      'INSERT INTO matches (id, get_together_id, game, status, team_size, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['m2', 'gt1', 'generala', 'finished', null, now, now],
    ],
    [
      'INSERT INTO matches (id, get_together_id, game, status, team_size, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['m3', 'gt1', 'skull-king', 'active', null, now, null],
    ],
    [
      'INSERT INTO matches (id, get_together_id, game, status, team_size, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['m4', 'gt1', 'generic', 'active', null, now, null],
    ],
    [
      'INSERT INTO matches (id, get_together_id, game, status, team_size, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['m5', 'gt1', 'fifa', 'active', null, now, null],
    ],
    ['INSERT INTO match_players (match_id, person_id, team, position) VALUES (?, ?, NULL, ?)', ['m1', 'p1', 0]],
    ['INSERT INTO truco_rounds (id, match_id, round_number, team1_points, team2_points, created_at) VALUES (?, ?, ?, ?, ?, ?)', ['tr1', 'm1', 1, 10, 5, now]],
    ['INSERT INTO generala_entries (match_id, person_id, box, points, tachado, created_at) VALUES (?, ?, ?, ?, ?, ?)', ['m2', 'p1', '1', 3, 0, now]],
    ['INSERT INTO skull_king_rounds (match_id, round_number, person_id, bid, tricks, bonus, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['m3', 1, 'p1', 1, 1, 0, now]],
    ['INSERT INTO generic_adjustments (id, match_id, person_id, points, created_at) VALUES (?, ?, ?, ?, ?)', ['ga1', 'm4', 'p1', 10, now]],
    ['INSERT INTO fifa_tournaments (match_id, mode, created_at, matches_per_opponent) VALUES (?, ?, ?, ?)', ['m5', 'league', now, null]],
    [
      'INSERT INTO fifa_games (id, match_id, round, slot, player1_id, player2_id, score1, score2, penalty_winner_id, played_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)',
      ['fg1', 'm5', 1, 1, 'p1', 'p2', 2, 1, now],
    ],
    [
      'INSERT INTO get_togethers (id, name, date, status, closed_at, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)',
      ['gt2', 'Otra', now, 'active', now, now],
    ],
    [
      'INSERT INTO expenses (id, get_together_id, payer_id, description, amount_int, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
      ['e2', 'gt2', 'p1', 'Taxi', 500, now, now],
    ],
    [
      'INSERT INTO settlements (id, get_together_id, from_id, to_id, amount_int, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
      ['s2', 'gt2', 'p2', 'p1', 200, now, now],
    ],
    [
      'INSERT INTO matches (id, get_together_id, game, status, team_size, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['m6', 'gt2', 'generic', 'active', null, now, null],
    ],
  ];
  for (const [sql, params] of rows) sqlite.prepare(sql).run(...params);
}

function countWhere(sqlite: DatabaseSync, table: string, column: string, value: string): number {
  const row = sqlite
    .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`)
    .get(value) as { count: number };
  return row.count;
}

describe('deleteGetTogether', () => {
  it('cascade-deletes expenses, settlements, matches and their game data', async () => {
    const { sqlite, db } = openMemoryDatabase();
    await migrateDatabase(db);
    seed(sqlite);

    await deleteGetTogether(db, 'gt1');

    expect(countWhere(sqlite, 'get_togethers', 'id', 'gt1')).toBe(0);
    expect(countWhere(sqlite, 'get_together_people', 'get_together_id', 'gt1')).toBe(0);
    expect(countWhere(sqlite, 'expenses', 'get_together_id', 'gt1')).toBe(0);
    expect(countWhere(sqlite, 'expense_participants', 'expense_id', 'e1')).toBe(0);
    expect(countWhere(sqlite, 'settlements', 'get_together_id', 'gt1')).toBe(0);
    expect(countWhere(sqlite, 'matches', 'get_together_id', 'gt1')).toBe(0);
    expect(countWhere(sqlite, 'match_players', 'match_id', 'm1')).toBe(0);
    expect(countWhere(sqlite, 'truco_rounds', 'match_id', 'm1')).toBe(0);
    expect(countWhere(sqlite, 'generala_entries', 'match_id', 'm2')).toBe(0);
    expect(countWhere(sqlite, 'skull_king_rounds', 'match_id', 'm3')).toBe(0);
    expect(countWhere(sqlite, 'generic_adjustments', 'match_id', 'm4')).toBe(0);
    expect(countWhere(sqlite, 'fifa_tournaments', 'match_id', 'm5')).toBe(0);
    expect(countWhere(sqlite, 'fifa_games', 'match_id', 'm5')).toBe(0);

    expect(countWhere(sqlite, 'get_togethers', 'id', 'gt2')).toBe(1);
    expect(countWhere(sqlite, 'expenses', 'get_together_id', 'gt2')).toBe(1);
    expect(countWhere(sqlite, 'settlements', 'get_together_id', 'gt2')).toBe(1);
    expect(countWhere(sqlite, 'matches', 'get_together_id', 'gt2')).toBe(1);
    expect(countWhere(sqlite, 'people', 'id', 'p1')).toBe(1);
  });

  it('never deletes the hidden casual get-together', async () => {
    const { sqlite, db } = openMemoryDatabase();
    await migrateDatabase(db);

    await deleteGetTogether(db, CASUAL_GET_TOGETHER_ID);
    await deleteGetTogether(db, 'missing');

    expect(countWhere(sqlite, 'get_togethers', 'id', CASUAL_GET_TOGETHER_ID)).toBe(1);
  });
});
