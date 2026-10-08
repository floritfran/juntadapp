import { GetTogetherId } from '../get-togethers/get-together-types';
import { PersonId } from '../people/person-types';

export type { GetTogetherId } from '../get-togethers/get-together-types';
export type { PersonId } from '../people/person-types';

export type MatchId = string;

export type GameId = 'truco' | 'generala' | 'skull-king';

export const GAME_LABELS: Record<GameId, string> = {
  truco: 'Truco',
  generala: 'Generala',
  'skull-king': 'Skull King',
};

export type MatchStatus = 'active' | 'finished';

export type TrucoTeamSize = 1 | 2 | 3;

export type TrucoTeam = 1 | 2;

export interface MatchPlayer {
  personId: PersonId;
  position: number;
  team: TrucoTeam | null;
}

export interface Match {
  id: MatchId;
  getTogetherId: GetTogetherId;
  game: GameId;
  status: MatchStatus;
  teamSize: TrucoTeamSize | null;
  players: MatchPlayer[];
  createdAt: Date;
  finishedAt?: Date | null;
}
