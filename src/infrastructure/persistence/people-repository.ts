import type { SQLiteDatabase } from 'expo-sqlite';

import { Person, PersonId } from '../../domain/people/person-types';
import { newId } from '../id';

interface PersonRow {
  id: string;
  name: string;
  deleted_at: number | null;
  created_at: number;
}

function rowToPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    deletedAt: row.deleted_at != null ? new Date(row.deleted_at) : null,
    createdAt: new Date(row.created_at),
  };
}

export async function listPeople(db: SQLiteDatabase): Promise<Person[]> {
  const rows = await db.getAllAsync<PersonRow>(
    'SELECT * FROM people WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC'
  );
  return rows.map(rowToPerson);
}

export async function listAllPeople(db: SQLiteDatabase): Promise<Person[]> {
  const rows = await db.getAllAsync<PersonRow>(
    'SELECT * FROM people ORDER BY name COLLATE NOCASE ASC'
  );
  return rows.map(rowToPerson);
}

export async function createPerson(db: SQLiteDatabase, name: string): Promise<Person> {
  const person: Person = {
    id: newId(),
    name: name.trim(),
    deletedAt: null,
    createdAt: new Date(),
  };
  await db.runAsync(
    'INSERT INTO people (id, name, deleted_at, created_at) VALUES (?, ?, NULL, ?)',
    person.id,
    person.name,
    person.createdAt.getTime()
  );
  return person;
}

export async function softDeletePerson(db: SQLiteDatabase, id: PersonId): Promise<void> {
  await db.runAsync('UPDATE people SET deleted_at = ? WHERE id = ?', Date.now(), id);
}
