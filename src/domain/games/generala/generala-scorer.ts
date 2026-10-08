import { PersonId } from '../game-types';
import {
  GeneralaBox,
  GeneralaEntry,
  GeneralaTotals,
  GENERALA_BOXES,
  LOWER_BOXES,
  LowerBox,
  UPPER_BOXES,
} from './generala-types';

export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS_POINTS = 35;

export function isUpperBox(box: GeneralaBox): boolean {
  return (UPPER_BOXES as readonly string[]).includes(box);
}

export function isLowerBox(box: GeneralaBox): box is LowerBox {
  return (LOWER_BOXES as readonly string[]).includes(box);
}

export function availableBoxes(entries: readonly GeneralaEntry[]): GeneralaBox[] {
  const filled = new Set(entries.map((entry) => entry.box));
  return GENERALA_BOXES.filter((box) => !filled.has(box));
}

export function isBoxAvailable(entries: readonly GeneralaEntry[], box: GeneralaBox): boolean {
  return availableBoxes(entries).includes(box);
}

export function addGeneralaEntry(entries: readonly GeneralaEntry[], entry: GeneralaEntry): GeneralaEntry[] {
  if (!Number.isInteger(entry.points) || entry.points < 0) {
    throw new Error('points must be a non negative integer');
  }
  if (isBoxAvailable(entries, entry.box) === false) {
    throw new Error('box already filled');
  }
  return [...entries, { ...entry, points: entry.tachado ? 0 : entry.points }];
}

export function tacharEntry(box: GeneralaBox): GeneralaEntry {
  return { box, points: 0, tachado: true };
}

export function computeGeneralaTotals(entries: readonly GeneralaEntry[]): GeneralaTotals {
  const pointsOf = (box: GeneralaBox) => entries.find((entry) => entry.box === box)?.points ?? 0;
  const upper = UPPER_BOXES.reduce((sum, box) => sum + pointsOf(box), 0);
  const lower = LOWER_BOXES.reduce((sum, box) => sum + pointsOf(box), 0);
  const upperBonus = upper >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS_POINTS : 0;
  return { upper, upperBonus, lower, total: upper + upperBonus + lower };
}

export function isGeneralaComplete(entries: readonly GeneralaEntry[]): boolean {
  return entries.length === GENERALA_BOXES.length;
}

export function nextGeneralaTurn(
  order: readonly PersonId[],
  entriesByPlayer: Readonly<Record<string, readonly GeneralaEntry[]>>
): { personId: PersonId; index: number } | null {
  let next: { personId: PersonId; index: number; filled: number } | null = null;
  for (let index = 0; index < order.length; index += 1) {
    const entries = entriesByPlayer[order[index]] ?? [];
    if (isGeneralaComplete(entries)) continue;
    if (next === null || entries.length < next.filled) {
      next = { personId: order[index], index, filled: entries.length };
    }
  }
  return next === null ? null : { personId: next.personId, index: next.index };
}

export function generalaStandings(
  order: readonly PersonId[],
  entriesByPlayer: Readonly<Record<string, readonly GeneralaEntry[]>>
): { personId: PersonId; total: number }[] {
  return order
    .map((personId) => ({ personId, total: computeGeneralaTotals(entriesByPlayer[personId] ?? []).total }))
    .sort((a, b) => b.total - a.total);
}

export function generalaWinners(
  order: readonly PersonId[],
  entriesByPlayer: Readonly<Record<string, readonly GeneralaEntry[]>>
): PersonId[] {
  const standings = generalaStandings(order, entriesByPlayer);
  if (standings.length === 0) return [];
  return standings.filter((row) => row.total === standings[0].total).map((row) => row.personId);
}
