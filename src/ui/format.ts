import dayjs from 'dayjs';

export function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseAmountToInt(text: string): number {
  const digits = text.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

export function formatMoney(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$ ${groupDigits(String(Math.abs(Math.trunc(amount))))}`;
}

export function formatDate(date: Date): string {
  return dayjs(date).format('DD/MM/YYYY');
}
