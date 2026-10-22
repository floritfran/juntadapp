import { PersonId } from '../game-types';

export type FifaMode = 'league' | 'cup';

export const FIFA_MODE_LABELS: Record<FifaMode, string> = {
  league: 'Liga',
  cup: 'Copa',
};

export interface FifaGame {
  id: string;
  round: number;
  slot: number;
  player1Id: PersonId | null;
  player2Id: PersonId | null;
  score1: number | null;
  score2: number | null;
  penaltyWinnerId: PersonId | null;
  playedAt: Date | null;
}

export interface FifaGamePlan {
  round: number;
  slot: number;
  player1Id: PersonId | null;
  player2Id: PersonId | null;
}

export interface FifaResult {
  score1: number;
  score2: number;
  penaltyWinnerId?: PersonId | null;
}

export interface FifaStandingRow {
  personId: PersonId;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface FifaCupResultPlan {
  games: FifaGame[];
  winnerId: PersonId;
  championId: PersonId | null;
}
