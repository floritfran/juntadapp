import { PersonId } from '../game-types';
import { GenericAdjustment, GenericTotal } from './generic-types';

export function validateGenericAdjustment(points: number): void {
  if (!Number.isInteger(points)) {
    throw new Error('points must be an integer');
  }
  if (points === 0) {
    throw new Error('points must not be zero');
  }
}

export function genericTotals(
  playerIds: readonly PersonId[],
  adjustments: readonly GenericAdjustment[]
): GenericTotal[] {
  const totals = new Map<PersonId, number>();
  playerIds.forEach((personId) => totals.set(personId, 0));
  adjustments.forEach((adjustment) => {
    totals.set(adjustment.personId, (totals.get(adjustment.personId) ?? 0) + adjustment.points);
  });
  return [...totals.entries()]
    .map(([personId, total]) => ({ personId, total }))
    .sort((a, b) => b.total - a.total);
}

export function genericWinners(totals: readonly GenericTotal[]): PersonId[] {
  if (totals.length === 0) return [];
  const best = Math.max(...totals.map((row) => row.total));
  return totals.filter((row) => row.total === best).map((row) => row.personId);
}