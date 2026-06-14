import type { EmployeeAccountType } from '@src/types/bankAccount';

export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export function normalizeIfsc(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidIfsc(value: string): boolean {
  return IFSC_REGEX.test(normalizeIfsc(value));
}

export function isValidUpiId(value: string): boolean {
  return UPI_ID_REGEX.test(value.trim());
}

export function isValidAccountNumber(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 6 && trimmed.length <= 50;
}

export const EMPLOYEE_ACCOUNT_TYPES: EmployeeAccountType[] = [
  'savings',
  'current',
  'upi',
];

export function accountTypeLabelKey(type: EmployeeAccountType | string): string {
  return `settings.bankAccounts.accountTypes.${type}`;
}

function maskAccountNumber(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return trimmed;
  }
  return `****${trimmed.slice(-4)}`;
}

export function accountDisplayLine(account: {
  account_type: EmployeeAccountType | string;
  bank_name?: string | null;
  account_number?: string | null;
  masked_account_number?: string | null;
  masked_upi_id?: string | null;
  upi_id?: string | null;
  account_holder_name?: string | null;
}): string {
  if (account.account_type === 'upi') {
    return account.masked_upi_id?.trim() || account.upi_id?.trim() || '—';
  }
  if (account.account_type === 'cash') {
    return account.account_holder_name?.trim() || '—';
  }
  const bank = account.bank_name?.trim();
  const masked =
    account.masked_account_number?.trim() ||
    (account.account_number ? maskAccountNumber(account.account_number) : '');
  if (bank && masked) {
    return `${bank} · ${masked}`;
  }
  return bank || masked || '—';
}
