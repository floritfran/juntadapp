import { PersonId } from '../game-types';
import {
  cardsInRound,
  SKULL_KING_TOTAL_ROUNDS,
  SkullKingRoundEntry,
} from './skull-king-types';

export const EXACT_ZERO_BID_POINTS_PER_ROUND = 10;
export const EXACT_BID_POINTS_PER_UNIT = 20;
export const MISS_PENALTY_PER_UNIT = 10;

export function validateSkullKingRound(round: number): void {
  if (!Number.isInteger(round) || round < 1 || round > SKULL_KING_TOTAL_ROUNDS) {
    throw new Error('round must be between 1 and 10');
  }
}

export function validateSkullKingEntry(entry: SkullKingRoundEntry): void {
  validateSkullKingRound(entry.round);
  if (!Number.isInteger(entry.bid) || entry.bid < 0 || entry.bid > cardsInRound(entry.round)) {
    throw new Error(`bid must be between 0 and ${cardsInRound(entry.round)}`);
  }
  if (!Number.isInteger(entry.tricks) || entry.tricks < 0 || entry.tricks > cardsInRound(entry.round)) {
    throw new Error(`tricks must be between 0 and ${cardsInRound(entry.round)}`);
  }
  if (!Number.isInteger(entry.bonus)) {
    throw new Error('bonus must be an integer');
  }
}

export function skullKingRoundPoints(entry: SkullKingRoundEntry): number {
  validateSkullKingRound(entry.round);
  if (entry.bid !== entry.tricks) {
    return -MISS_PENALTY_PER_UNIT * Math.abs(entry.bid - entry.tricks);
  }
  const base = entry.bid === 0 ? EXACT_ZERO_BID_POINTS_PER_ROUND * entry.round : EXACT_BID_POINTS_PER_UNIT * entry.bid;
  return base + entry.bonus;
}

export function withPoints(entry: SkullKingRoundEntry): SkullKingRoundEntry & { points: number } {
  return { ...entry, points: skullKingRoundPoints(entry) };
}

export function skullKingTotals(entries: readonly SkullKingRoundEntry[]): { personId: PersonId; total: number }[] {
  const totals = new Map<PersonId, number>();
  entries.forEach((entry) => {
    totals.set(entry.personId, (totals.get(entry.personId) ?? 0) + skullKingRoundPoints(entry));
  });
  return [...totals.entries()]
    .map(([personId, total]) => ({ personId, total }))
    .sort((a, b) => b.total - a.total);
}

export function isSkullKingComplete(entries: readonly SkullKingRoundEntry[], playerCount: number): boolean {
  if (playerCount < 1) return false;
  for (let round = 1; round <= SKULL_KING_TOTAL_ROUNDS; round += 1) {
    const entriesInRound = entries.filter((entry) => entry.round === round).length;
    if (entriesInRound !== playerCount) return false;
  }
  return true;
}
