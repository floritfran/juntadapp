import { PersonId } from '../people/person-types';

export type GetTogetherId = string;

export type GetTogetherStatus = 'active' | 'closed';

export interface GetTogether {
  id: GetTogetherId;
  name: string;
  date: Date;
  status: GetTogetherStatus;
  closedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  participantIds: PersonId[];
}
