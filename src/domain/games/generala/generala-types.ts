import { PersonId } from '../game-types';

export type GeneralaBox =
  | 'ones'
  | 'twos'
  | 'threes'
  | 'fours'
  | 'fives'
  | 'sixes'
  | 'escalera'
  | 'full'
  | 'poker'
  | 'generala'
  | 'dobleGenerala';

export type LowerBox = 'escalera' | 'full' | 'poker' | 'generala' | 'dobleGenerala';

export const GENERALA_BOXES: readonly GeneralaBox[] = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
  'escalera',
  'full',
  'poker',
  'generala',
  'dobleGenerala',
];

export const UPPER_BOXES: readonly GeneralaBox[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];

export const LOWER_BOXES: readonly LowerBox[] = ['escalera', 'full', 'poker', 'generala', 'dobleGenerala'];

export const LOWER_BOX_LABELS: Record<LowerBox, string> = {
  escalera: 'Escalera',
  full: 'Full',
  poker: 'Póker',
  generala: 'Generala',
  dobleGenerala: 'Doble Generala',
};

export const GENERALA_BOX_LABELS: Record<GeneralaBox, string> = {
  ones: 'Ases',
  twos: 'Dos',
  threes: 'Tres',
  fours: 'Cuatros',
  fives: 'Cincos',
  sixes: 'Seises',
  escalera: 'Escalera',
  full: 'Full',
  poker: 'Póker',
  generala: 'Generala',
  dobleGenerala: 'Doble Generala',
};

export const LOWER_BOX_OPTIONS: Record<LowerBox, readonly number[]> = {
  escalera: [20, 25],
  full: [30, 35],
  poker: [40, 45],
  generala: [50, 55],
  dobleGenerala: [100, 105],
};

export interface GeneralaEntry {
  box: GeneralaBox;
  points: number;
  tachado: boolean;
}

export interface GeneralaTotals {
  upper: number;
  upperBonus: number;
  lower: number;
  total: number;
}

export interface GeneralaTurn {
  personId: PersonId;
  index: number;
}
