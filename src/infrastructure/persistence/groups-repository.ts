import type { SQLiteDatabase } from 'expo-sqlite';

import { Group, GroupId } from '../../domain/groups/group-types';
import { Person, PersonId } from '../../domain/people/person-types';
import { newId } from '../id';

export interface GroupWithMembers extends Group {
  members: Person[];
}

interface GroupMemberRow {
  g_id: string;
  g_name: string;
  g_deleted_at: number | null;
  g_created_at: number;
  p_id: string | null;
  p_name: string | null;
  p_deleted_at: number | null;
  p_created_at: number | null;
}

export async function listGroups(db: SQLiteDatabase): Promise<GroupWithMembers[]> {
  const rows = await db.getAllAsync<GroupMemberRow>(
    `SELECT g.id AS g_id, g.name AS g_name, g.deleted_at AS g_deleted_at, g.created_at AS g_created_at,
            p.id AS p_id, p.name AS p_name, p.deleted_at AS p_deleted_at, p.created_at AS p_created_at
       FROM groups g
       LEFT JOIN group_members gm ON gm.group_id = g.id
       LEFT JOIN people p ON p.id = gm.person_id AND p.deleted_at IS NULL
      WHERE g.deleted_at IS NULL
      ORDER BY g.name COLLATE NOCASE ASC, gm.position ASC`
  );

  const groups = new Map<GroupId, GroupWithMembers>();
  for (const row of rows) {
    let entry = groups.get(row.g_id);
    if (!entry) {
      entry = {
        id: row.g_id,
        name: row.g_name,
        memberIds: [],
        deletedAt: row.g_deleted_at != null ? new Date(row.g_deleted_at) : null,
        createdAt: new Date(row.g_created_at),
        members: [],
      };
      groups.set(row.g_id, entry);
    }
    if (row.p_id != null && row.p_created_at != null) {
      const member: Person = {
        id: row.p_id,
        name: row.p_name ?? '',
        deletedAt: row.p_deleted_at != null ? new Date(row.p_deleted_at) : null,
        createdAt: new Date(row.p_created_at),
      };
      entry.memberIds.push(member.id);
      entry.members.push(member);
    }
  }
  return [...groups.values()];
}

export async function createGroup(
  db: SQLiteDatabase,
  input: { name: string; memberIds: PersonId[] }
): Promise<Group> {
  const group: Group = {
    id: newId(),
    name: input.name.trim(),
    memberIds: input.memberIds,
    deletedAt: null,
    createdAt: new Date(),
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO groups (id, name, deleted_at, created_at) VALUES (?, ?, NULL, ?)',
      group.id,
      group.name,
      group.createdAt.getTime()
    );
    for (let position = 0; position < group.memberIds.length; position++) {
      await db.runAsync(
        'INSERT INTO group_members (group_id, person_id, position) VALUES (?, ?, ?)',
        group.id,
        group.memberIds[position],
        position
      );
    }
  });
  return group;
}

export async function softDeleteGroup(db: SQLiteDatabase, id: GroupId): Promise<void> {
  await db.runAsync('UPDATE groups SET deleted_at = ? WHERE id = ?', Date.now(), id);
}
