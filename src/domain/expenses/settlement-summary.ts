import { MoneyInt, formatMoneyInt } from '../common/Money';

export interface SummaryTransfer {
  fromName: string;
  toName: string;
  amount: MoneyInt;
}

export interface SettlementSummary {
  title: string;
  totalInt: MoneyInt;
  transfers: SummaryTransfer[];
}

export function buildSettlementSummaryText(summary: SettlementSummary): string {
  const lines = [`💰 ${summary.title}`, `Total gastado: ${formatMoneyInt(summary.totalInt)}`];
  if (summary.transfers.length === 0) {
    lines.push('', 'Ya está todo saldado ✅');
    return lines.join('\n');
  }
  lines.push('', 'A pagar:');
  for (const transfer of summary.transfers) {
    lines.push(
      `${transfer.fromName} le pasa ${formatMoneyInt(transfer.amount)} a ${transfer.toName}`
    );
  }
  return lines.join('\n');
}
