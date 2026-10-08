import { MoneyInt } from '../common/Money';
import { GetTogetherId } from '../get-togethers/get-together-types';
import { PersonId } from '../people/person-types';

export type { GetTogetherId } from '../get-togethers/get-together-types';
export type { PersonId } from '../people/person-types';

export type ExpenseId = string;

export interface Expense {
  id: ExpenseId;
  getTogetherId: GetTogetherId;
  payerId: PersonId;
  description: string;
  amountInt: MoneyInt;
  participantIds: PersonId[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface Balance {
  personId: PersonId;
  net: MoneyInt; // paid - owes
}

export interface Transfer {
  from: PersonId;
  to: PersonId;
  amount: MoneyInt;
}
