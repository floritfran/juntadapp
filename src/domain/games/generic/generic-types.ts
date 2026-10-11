import { PersonId } from '../game-types';

export interface GenericAdjustment {
  id: string;
  personId: PersonId;
  points: number;
  createdAt: Date;
}

export interface GenericTotal {
  personId: PersonId;
  total: number;
}