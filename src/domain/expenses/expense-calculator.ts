import { MoneyInt, splitEvenly } from '../common/Money';
import { Balance, Expense, PersonId, Transfer } from './expense-types';

export function calculateShares(expense: Expense): Record<PersonId, MoneyInt> {
  const participants = expense.participantIds;
  if (participants.length === 0) return {};
  const shares = splitEvenly(expense.amountInt, participants.length);
  const out: Record<PersonId, MoneyInt> = {};
  participants.forEach((pid, idx) => {
    out[pid] = shares[idx] ?? 0;
  });
  return out;
}

export function calculateBalances(expenses: Expense[]): Balance[] {
  const paid: Map<PersonId, MoneyInt> = new Map();
  const owed: Map<PersonId, MoneyInt> = new Map();

  expenses
    .filter((e) => !e.deletedAt)
    .forEach((e) => {
      paid.set(e.payerId, (paid.get(e.payerId) ?? 0) + e.amountInt);
      const shares = calculateShares(e);
      Object.entries(shares).forEach(([pid, amt]) => {
        owed.set(pid, (owed.get(pid) ?? 0) + amt);
      });
    });

  const all = new Set([...paid.keys(), ...owed.keys()]);
  const balances: Balance[] = [];
  for (const pid of all) {
    const p = paid.get(pid) ?? 0;
    const o = owed.get(pid) ?? 0;
    balances.push({ personId: pid, net: p - o });
  }
  return balances;
}

export function calculateDirectTransfers(expenses: Expense[]): Transfer[] {
  const balances = calculateBalances(expenses).filter((b) => b.net !== 0);
  const transfers: Transfer[] = [];
  for (let i = 0; i < balances.length; i++) {
    for (let j = i + 1; j < balances.length; j++) {
      const a = balances[i];
      const b = balances[j];
      if (a.net > 0 && b.net < 0) {
        const amt = Math.min(a.net, -b.net);
        if (amt > 0) {
          transfers.push({ from: b.personId, to: a.personId, amount: amt });
        }
      }
      if (a.net < 0 && b.net > 0) {
        const amt = Math.min(-a.net, b.net);
        if (amt > 0) {
          transfers.push({ from: a.personId, to: b.personId, amount: amt });
        }
      }
    }
  }
  return transfers;
}

export function minimizeTransfers(expenses: Expense[]): Transfer[] {
  const balances = calculateBalances(expenses)
    .map((b) => ({ personId: b.personId, net: b.net }))
    .filter((b) => b.net !== 0);

  const creditors: { personId: PersonId; amount: MoneyInt }[] = [];
  const debtors: { personId: PersonId; amount: MoneyInt }[] = [];

  balances.forEach((b) => {
    if (b.net > 0) creditors.push({ personId: b.personId, amount: b.net });
    else if (b.net < 0) debtors.push({ personId: b.personId, amount: -b.net });
  });

  // sort desc
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let i = 0; // creditors
  let j = 0; // debtors
  while (i < creditors.length && j < debtors.length) {
    const c = creditors[i];
    const d = debtors[j];
    const amt = Math.min(c.amount, d.amount);
    if (amt > 0) {
      transfers.push({ from: d.personId, to: c.personId, amount: amt });
    }
    c.amount -= amt;
    d.amount -= amt;
    if (c.amount === 0) i++;
    if (d.amount === 0) j++;
  }
  return transfers;
}
