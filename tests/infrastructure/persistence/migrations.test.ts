/** @jest-environment node */

import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

import {
  CASUAL_GET_TOGETHER_ID,
  MIGRATIONS,
  migrateDatabase,
} from '@/infrastructure/persistence/migrations';

const EXPECTED_TABLES = [
  'expense_participants',
  'expenses',
  'fifa_games',
  'fifa_tournaments',
  'generala_entries',
  'generic_adjustments',
  'get_together_people',
  'get_togethers',
  'group_members',
  'groups',
  'match_players',
  'matches',
  'people',
  'settlements',
  'skull_king_rounds',
  'truco_rounds',
];

const EXPECTED_INDEXES = [
  'idx_expenses_get_together',
  'idx_fifa_games_match',
  'idx_generic_adjustments_match',
  'idx_matches_get_together',
  'idx_settlements_get_together',
];

function openMemoryDatabase(): { sqlite: DatabaseSync; db: SQLiteDatabase } {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => {
      sqlite.exec(sql);
    },
    getFirstAsync: async <T>(sql: string) => sqlite.prepare(sql).get() as T | undefined,
  } as unknown as SQLiteDatabase;
  return { sqlite, db };
}

function userVersion(sqlite: DatabaseSync): number {
  const row = sqlite.prepare('PRAGMA user_version').get() as { user_version: number };
  return row.user_version;
}

function tableNames(sqlite: DatabaseSync): string[] {
  const rows = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((row) => row.name);
}

function indexNames(sqlite: DatabaseSync): string[] {
  const rows = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((row) => row.name);
}

function columnNames(sqlite: DatabaseSync, table: string): string[] {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.map((row) => row.name);
}

function countCasualGetTogethers(sqlite: DatabaseSync): number {
  const row = sqlite
    .prepare('SELECT COUNT(*) AS count FROM get_togethers WHERE id = ?')
    .get(CASUAL_GET_TOGETHER_ID) as { count: number };
  return row.count;
}

describe('database migrations', () => {
  it('migrates an empty database to version 8 with the full schema', async () => {
    const { sqlite, db } = openMemoryDatabase();

    await migrateDatabase(db);

    expect(userVersion(sqlite)).toBe(8);
    expect(tableNames(sqlite)).toEqual(EXPECTED_TABLES);
    expect(indexNames(sqlite)).toEqual(EXPECTED_INDEXES);

    expect(columnNames(sqlite, 'truco_rounds')).toEqual([
      'id',
      'match_id',
      'round_number',
      'team1_points',
      'team2_points',
      'created_at',
    ]);
    expect(columnNames(sqlite, 'fifa_tournaments')).toEqual([
      'match_id',
      'mode',
      'created_at',
      'matches_per_opponent',
    ]);
    expect(columnNames(sqlite, 'settlements')).toEqual([
      'id',
      'get_together_id',
      'from_id',
      'to_id',
      'amount_int',
      'created_at',
      'updated_at',
      'deleted_at',
    ]);

    const casual = sqlite
      .prepare('SELECT id, name, status FROM get_togethers WHERE id = ?')
      .get(CASUAL_GET_TOGETHER_ID) as { id: string; name: string; status: string };
    expect(casual).toEqual({ id: CASUAL_GET_TOGETHER_ID, name: 'Casual', status: 'closed' });
  });

  it('upgrades a version 6 database incrementally to version 8', async () => {
    const { sqlite, db } = openMemoryDatabase();

    for (const migration of MIGRATIONS) {
      if (migration.version > 6) continue;
      sqlite.exec(migration.sql);
    }
    sqlite.exec('PRAGMA user_version = 6;');

    expect(userVersion(sqlite)).toBe(6);
    expect(columnNames(sqlite, 'fifa_tournaments')).not.toContain('matches_per_opponent');
    expect(countCasualGetTogethers(sqlite)).toBe(0);

    await migrateDatabase(db);

    expect(userVersion(sqlite)).toBe(8);
    expect(columnNames(sqlite, 'fifa_tournaments')).toContain('matches_per_opponent');
    expect(countCasualGetTogethers(sqlite)).toBe(1);
  });

  it('is idempotent when run twice', async () => {
    const { sqlite, db } = openMemoryDatabase();

    await migrateDatabase(db);
    await migrateDatabase(db);

    expect(userVersion(sqlite)).toBe(8);
    expect(countCasualGetTogethers(sqlite)).toBe(1);
  });
});
