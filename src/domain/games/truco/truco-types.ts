import { PersonId, TrucoTeam } from '../game-types';

export type { TrucoTeam } from '../game-types';

export const TRUCO_TARGET_SCORE = 30;
export const TRUCO_HALF_SCORE = 15;

export interface TrucoScore {
  team1: number;
  team2: number;
}

export interface TrucoRound {
  roundNumber: number;
  team1Points: number;
  team2Points: number;
}

export interface TrucoPlayer {
  personId: PersonId;
  team: TrucoTeam;
}
