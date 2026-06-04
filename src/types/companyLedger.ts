export type LedgerTransactionType =
  | 'payment'
  | 'receive'
  | 'salary'
  | 'opening_balance'
  | 'fine'
  | 'bonus';

export const LEDGER_TRANSACTION_TYPES: LedgerTransactionType[] = [
  'payment',
  'receive',
  'salary',
  'opening_balance',
  'fine',
  'bonus',
];

export type LedgerUserRole = 'admin' | 'employee';

export type LedgerActor = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: LedgerUserRole;
};

export type LedgerEmployee = {
  id: number;
  name: string;
  email: string | null;
  mobile: string | null;
  designation: string | null;
  profile_picture: string | null;
};

export type LedgerTransaction = {
  id: number;
  transaction_date: string;
  amount: number;
  transaction_type: string;
  type: 'debit' | 'credit' | null;
  old_balance: number;
  new_balance: number;
  remarks: string | null;
  employee?: LedgerEmployee | null;
  create_by: LedgerActor | null;
  create_date: string;
  modify_by: LedgerActor | null;
  modify_date: string;
};

export type CompanyLedgerData = {
  opening_balance: number;
  list: LedgerTransaction[];
};

export type CompanyLedgerMeta = {
  credit: number;
  debit: number;
  net: number;
};

export type CompanyLedgerResponse = {
  success: boolean;
  message?: string;
  data: CompanyLedgerData | null;
  meta: CompanyLedgerMeta | null;
};
