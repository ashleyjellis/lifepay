export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const hasDecimals = abs % 1 !== 0;
  const formatted = hasDecimals
    ? abs.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : abs.toLocaleString('en-GB');
  return `${amount < 0 ? '-' : ''}£${formatted}`;
}

export function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

export function nextOccurrence(dayOfMonth: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const result = new Date(d.getFullYear(), d.getMonth(), dayOfMonth);
  if (result <= d) {
    result.setMonth(result.getMonth() + 1);
  }
  return result;
}

export function currentPayPeriod(paydayDay: number): string {
  const now = new Date();
  const day = now.getDate();
  if (day >= paydayDay) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}
