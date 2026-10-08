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
