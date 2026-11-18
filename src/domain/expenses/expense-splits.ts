import { MoneyInt, splitEvenly, sum } from '../common/Money';
import { PersonId } from '../people/person-types';
import { SplitMode, SplitValues } from './expense-types';

export const PERCENTAGE_TOTAL_BPS = 10_000;

export type SplitValidationError = 'missing' | 'invalid' | 'negative' | 'sum' | null;

export function validateSplit(
  mode: SplitMode,
  amountInt: MoneyInt,
  participantIds: PersonId[],
  values: SplitValues | null | undefined
): SplitValidationError {
  if (mode === 'equal') return null;
  if (participantIds.length === 0) return 'missing';
  if (values == null) return 'missing';

  for (const personId of participantIds) {
    const value = values[personId];
    if (value == null || !Number.isFinite(value)) return 'missing';
    if (!Number.isInteger(value)) return 'invalid';
    if (value < 0) return 'negative';
    if (mode === 'percentage' && value > PERCENTAGE_TOTAL_BPS) return 'invalid';
  }

  const expected = mode === 'percentage' ? PERCENTAGE_TOTAL_BPS : amountInt;
  return sum(participantIds.map((personId) => values[personId])) === expected ? null : 'sum';
}

export function calculatePercentageShares(
  amountInt: MoneyInt,
  participantIds: PersonId[],
  values: SplitValues
): SplitValues {
  const parts = participantIds.map((personId, index) => {
    const product = amountInt * values[personId];
    return {
      personId,
      index,
      amount: Math.floor(product / PERCENTAGE_TOTAL_BPS),
      remainder: product % PERCENTAGE_TOTAL_BPS,
    };
  });

  let missing = amountInt - sum(parts.map((part) => part.amount));
  const byRemainder = [...parts].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index
  );
  for (let i = 0; missing > 0 && i < byRemainder.length; i++, missing--) {
    byRemainder[i].amount += 1;
  }

  const out: SplitValues = {};
  parts.forEach((part) => {
    out[part.personId] = part.amount;
  });
  return out;
}

export function calculateSplitShares(
  mode: SplitMode,
  amountInt: MoneyInt,
  participantIds: PersonId[],
  values?: SplitValues | null
): SplitValues {
  if (participantIds.length === 0) return {};

  const valid = validateSplit(mode, amountInt, participantIds, values);
  if (mode === 'exact' && valid === null && values != null) {
    return Object.fromEntries(participantIds.map((personId) => [personId, values[personId]]));
  }
  if (mode === 'percentage' && valid === null && values != null) {
    return calculatePercentageShares(amountInt, participantIds, values);
  }

  const evenly = splitEvenly(amountInt, participantIds.length);
  const out: SplitValues = {};
  participantIds.forEach((personId, index) => {
    out[personId] = evenly[index] ?? 0;
  });
  return out;
}

export function parsePercentageInput(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') return 0;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) return null;
  const bps = Math.round(Number(normalized) * 100);
  return bps <= PERCENTAGE_TOTAL_BPS ? bps : null;
}

export function formatPercentageInput(bps: number): string {
  const value = bps / 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}
