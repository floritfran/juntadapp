import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'juntadapp.db';

interface Migration {
  version: number;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
CREATE TABLE people (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE group_members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (group_id, person_id)
);
CREATE TABLE get_togethers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  date INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  closed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE get_together_people (
  get_together_id TEXT NOT NULL REFERENCES get_togethers(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (get_together_id, person_id)
);
CREATE TABLE expenses (
  id TEXT PRIMARY KEY NOT NULL,
  get_together_id TEXT NOT NULL REFERENCES get_togethers(id) ON DELETE CASCADE,
  payer_id TEXT NOT NULL REFERENCES people(id),
  description TEXT NOT NULL,
  amount_int INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE TABLE expense_participants (
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (expense_id, person_id)
);
CREATE INDEX idx_expenses_get_together ON expenses(get_together_id);
`,
  },
  {
    version: 2,
    sql: `
CREATE TABLE matches (
  id TEXT PRIMARY KEY NOT NULL,
  get_together_id TEXT NOT NULL REFERENCES get_togethers(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  team_size INTEGER,
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE TABLE match_players (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  team INTEGER,
  position INTEGER NOT NULL,
  PRIMARY KEY (match_id, person_id)
);
CREATE TABLE truco_rounds (
  id TEXT PRIMARY KEY NOT NULL,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  winner_team INTEGER NOT NULL,
  points INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (match_id, round_number)
);
CREATE TABLE generala_entries (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  box TEXT NOT NULL,
  points INTEGER NOT NULL,
  tachado INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (match_id, person_id, box)
);
CREATE TABLE skull_king_rounds (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  bid INTEGER NOT NULL,
  tricks INTEGER NOT NULL,
  bonus INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (match_id, round_number, person_id)
);
CREATE INDEX idx_matches_get_together ON matches(get_together_id);
`,
  },
  {
    version: 3,
    sql: `
CREATE TABLE truco_rounds_v3 (
  id TEXT PRIMARY KEY NOT NULL,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  team1_points INTEGER NOT NULL,
  team2_points INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (match_id, round_number)
);
INSERT INTO truco_rounds_v3 (id, match_id, round_number, team1_points, team2_points, created_at)
  SELECT id,
         match_id,
         round_number,
         CASE WHEN winner_team = 1 THEN points ELSE 0 END,
         CASE WHEN winner_team = 2 THEN points ELSE 0 END,
         created_at
  FROM truco_rounds;
DROP TABLE truco_rounds;
ALTER TABLE truco_rounds_v3 RENAME TO truco_rounds;
`,
  },
];

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`PRAGMA journal_mode = 'wal';`);
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;
  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    await db.execAsync(migration.sql);
    currentVersion = migration.version;
    await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
  }
}
