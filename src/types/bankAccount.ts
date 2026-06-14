export type BankOwnerType = 'employee' | 'company';

export type EmployeeAccountType = 'current' | 'savings' | 'upi' | 'cash';

export type BankAccountStatus = 'active' | 'inactive';

export type IfscLookupData = {
  ifsc: string;
  bank_name: string;
  branch: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  micr?: string;
  contact?: string;
  upi?: boolean;
};

export type IfscLookupResponse = {
  success: boolean;
  data?: IfscLookupData;
  message?: string;
};

export type BankAccountRecord = {
  id: number;
  company_id: number;
  employee_id: number | null;
  account_type: EmployeeAccountType;
  bank_name: string | null;
  account_holder_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  branch_name: string | null;
  upi_id: string | null;
  is_primary: number | boolean;
  status: BankAccountStatus;
  is_active: number | boolean;
  created_at?: string;
  updated_at?: string;
};

export type BankAccountListItem = {
  bank_account_id: number;
  company_id: number;
  employee_id: number;
  account_type: EmployeeAccountType;
  bank_name: string | null;
  account_holder_name: string | null;
  account_number: string | null;
  masked_account_number: string | null;
  ifsc_code: string | null;
  branch_name: string | null;
  upi_id: string | null;
  masked_upi_id: string | null;
  is_primary: boolean;
  status: BankAccountStatus;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type BankAccountsListMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  current_page_count: number;
  has_next_page: boolean;
  has_previous_page: boolean;
  is_last_page: boolean;
};

export type MyBankAccountsResponse = {
  success: boolean;
  message?: string;
  data?: BankAccountListItem[];
  meta?: BankAccountsListMeta;
};

export type CreateBankAccountPayload = {
  bank_owner_type: 'employee';
  employee_id: number;
  account_type: EmployeeAccountType;
  bank_name?: string | null;
  account_holder_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  branch_name?: string | null;
  upi_id?: string | null;
  is_primary?: boolean;
};

export type UpdateBankAccountPayload = {
  bank_id: number;
  account_type?: EmployeeAccountType;
  bank_name?: string | null;
  account_holder_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  branch_name?: string | null;
  upi_id?: string | null;
  is_primary?: boolean;
  status?: BankAccountStatus;
};

export type BankAccountMutationResponse = {
  success: boolean;
  message?: string;
  data?: BankAccountRecord;
};

export type DeleteBankAccountPayload = {
  bank_id: number;
};

export type DeleteBankAccountResponse = {
  success: boolean;
  message?: string;
};

export type FetchMyBankAccountsParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: BankAccountStatus;
  account_type?: EmployeeAccountType;
  is_primary?: boolean;
  sort_by?: 'created_at' | 'updated_at' | 'bank_name' | 'account_holder_name' | 'account_type';
  sort_order?: 'ASC' | 'DESC';
};
