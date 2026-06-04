import type { AppThemeColors } from '@src/theme/palettes';
import type { LedgerEmployee } from '@src/types/companyLedger';

export function formatLedgerAmount(value: number): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatLedgerShortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function humanizeLedgerKey(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function formatLedgerEmployeeLine(employee: LedgerEmployee): string {
  const name = employee.name.trim();
  const designation = employee.designation?.trim();
  if (designation) {
    return `${name} (${humanizeLedgerKey(designation)})`;
  }
  return name;
}

export function formatLedgerDateTime(value: string): string {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ledgerBalanceColor(
  balance: number,
  colors: AppThemeColors,
): string {
  if (balance < 0) {
    return colors.danger;
  }
  if (balance > 0) {
    return '#15803d';
  }
  return colors.text;
}

export type LedgerEntryType = 'debit' | 'credit' | 'neutral';

/** Resolves company debit/credit when API sends `type: null`. */
export function resolveLedgerEntryType(item: {
  type: 'debit' | 'credit' | null;
  old_balance: number;
  new_balance: number;
}): LedgerEntryType {
  if (item.type === 'credit') {
    return 'credit';
  }
  if (item.type === 'debit') {
    return 'debit';
  }
  const delta = item.new_balance - item.old_balance;
  if (delta > 0) {
    return 'debit';
  }
  if (delta < 0) {
    return 'credit';
  }
  return 'neutral';
}

/** Debit entries show positive; credit entries show negative (debit − credit = balance). */
export function formatSignedLedgerAmount(
  amount: number,
  entryType: LedgerEntryType,
): string {
  const formatted = formatLedgerAmount(amount);
  if (entryType === 'debit') {
    return `+${formatted}`;
  }
  if (entryType === 'credit') {
    return `-${formatted}`;
  }
  return formatted;
}
