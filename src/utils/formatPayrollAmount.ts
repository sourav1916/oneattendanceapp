export function coercePayrollAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatPayrollAmount(value: unknown, currency?: string | null): string {
  const n = coercePayrollAmount(value);
  const code = currency?.trim();
  if (code) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      /* fall through */
    }
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

export const MONTH_KEYS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

export function clampMonth(month: number): number {
  if (month < 1) {
    return 12;
  }
  if (month > 12) {
    return 1;
  }
  return month;
}

export function shiftMonthYear(
  month: number,
  year: number,
  delta: number,
): { month: number; year: number } {
  let m = month + delta;
  let y = year;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { month: m, year: y };
}
