/** @jest-environment node */

import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

import {
  createExpense,
  getExpense,
  listExpenses,
  updateExpense,
} from '@/infrastructure/persistence/expenses-repository';
import { migrateDatabase } from '@/infrastructure/persistence/migrations';

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'generated-id',
}));

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

async function seed(db: SQLiteDatabase): Promise<void> {
  await migrateDatabase(db);
  await db.runAsync(
    'INSERT INTO get_togethers (id, name, date, status, closed_at, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)',
    'gt1',
    'Juntada',
    Date.now(),
    'active',
    Date.now(),
    Date.now()
  );
  for (const [id, name] of [['p1', 'Ana'], ['p2', 'Beto'], ['p3', 'Cami']]) {
    await db.runAsync(
      'INSERT INTO people (id, name, deleted_at, created_at) VALUES (?, ?, NULL, ?)',
      id,
      name,
      Date.now()
    );
  }
}

describe('expenses repository splits', () => {
  it('persists and reads exact amounts', async () => {
    const { db, sqlite } = openMemoryDatabase();
    await seed(db);

    const created = await createExpense(db, {
      getTogetherId: 'gt1',
      payerId: 'p1',
      description: 'Comida',
      amountInt: 100,
      participantIds: ['p1', 'p2', 'p3'],
      splitMode: 'exact',
      splitValues: { p1: 70, p2: 30, p3: 0 },
    });

    expect(created.splitMode).toBe('exact');
    expect(created.splitValues).toEqual({ p1: 70, p2: 30, p3: 0 });

    const stored = await getExpense(db, created.id);
    expect(stored?.splitMode).toBe('exact');
    expect(stored?.splitValues).toEqual({ p1: 70, p2: 30, p3: 0 });
    expect(stored?.participantIds).toEqual(['p1', 'p2', 'p3']);

    const raw = sqlite
      .prepare('SELECT split_mode FROM expenses WHERE id = ?')
      .get(created.id) as { split_mode: string };
    expect(raw.split_mode).toBe('exact');
  });

  it('persists percentages as basis points and clears them on update', async () => {
    const { db } = openMemoryDatabase();
    await seed(db);

    const created = await createExpense(db, {
      getTogetherId: 'gt1',
      payerId: 'p2',
      description: 'Taxi',
      amountInt: 50,
      participantIds: ['p1', 'p2', 'p3'],
      splitMode: 'percentage',
      splitValues: { p1: 2000, p2: 0, p3: 8000 },
    });

    expect((await listExpenses(db, 'gt1'))[0]?.splitValues).toEqual({
      p1: 2000,
      p2: 0,
      p3: 8000,
    });

    await updateExpense(db, created.id, {
      payerId: 'p3',
      description: 'Taxi compartido',
      amountInt: 50,
      participantIds: ['p1', 'p3'],
      splitMode: 'equal',
      splitValues: null,
    });

    const updated = await getExpense(db, created.id);
    expect(updated?.splitMode).toBe('equal');
    expect(updated?.splitValues).toBeNull();
    expect(updated?.participantIds).toEqual(['p1', 'p3']);
  });

  it('treats missing split data as equal for backward compatibility', async () => {
    const { db, sqlite } = openMemoryDatabase();
    await seed(db);
    const now = Date.now();
    sqlite
      .prepare(
        'INSERT INTO expenses (id, get_together_id, payer_id, description, amount_int, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)'
      )
      .run('legacy', 'gt1', 'p1', 'Viejo', 30, now, now);
    sqlite
      .prepare('INSERT INTO expense_participants (expense_id, person_id, position) VALUES (?, ?, ?)')
      .run('legacy', 'p1', 0);

    const expense = await getExpense(db, 'legacy');
    expect(expense?.splitMode).toBe('equal');
    expect(expense?.splitValues).toBeNull();
  });
});
