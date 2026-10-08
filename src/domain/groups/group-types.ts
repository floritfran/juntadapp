import { PersonId } from '../people/person-types';

export type GroupId = string;

export interface Group {
  id: GroupId;
  name: string;
  memberIds: PersonId[];
  deletedAt?: Date | null;
  createdAt: Date;
}
