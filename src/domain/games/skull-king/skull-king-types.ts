import { PersonId } from '../game-types';

export const SKULL_KING_TOTAL_ROUNDS = 10;

export interface SkullKingRoundEntry {
  round: number;
  personId: PersonId;
  bid: number;
  tricks: number;
  bonus: number;
}

export const COMBAT_BONUSES = [
  { id: 'siren-beats-sk', label: 'Sirena > Skull King', points: 50 },
  { id: 'pirate-beats-siren', label: 'Pirata > Sirena', points: 20 },
  { id: 'sk-beats-pirate', label: 'Skull King > Pirata', points: 30 },
] as const;

export type CombatBonusId = (typeof COMBAT_BONUSES)[number]['id'];

export function cardsInRound(round: number): number {
  return round;
}
