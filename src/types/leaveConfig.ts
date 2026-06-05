export type CompanyLeaveConfig = {
  id: number;
  code: string;
  name: string;
  is_paid: boolean;
  allow_half_day: boolean;
  max_balance: number | null;
  carry_forward_limit: number;
  exclude_weekends: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CompanyLeaveConfigMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
};

export type CompanyLeaveConfigListResponse = {
  success: boolean;
  message: string;
  data: CompanyLeaveConfig[] | null;
  meta: CompanyLeaveConfigMeta | null;
};

export type FetchCompanyLeaveConfigsParams = {
  page?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
  is_paid?: boolean;
};

export type CreateLeaveConfigPayload = {
  code: string;
  name: string;
  is_paid?: boolean;
  allow_half_day?: boolean;
  max_balance?: number | null;
  carry_forward_limit?: number;
  exclude_weekends?: boolean;
};

export type UpdateLeaveConfigPayload = {
  id: number;
  code?: string;
  name?: string;
  is_paid?: boolean;
  allow_half_day?: boolean;
  max_balance?: number | null;
  carry_forward_limit?: number | null;
  exclude_weekends?: boolean;
  is_active?: boolean;
};

export type DeleteLeaveConfigPayload = {
  id: number;
};

export type CreateLeaveConfigResponse = {
  success: boolean;
  message: string;
};

export type UpdateLeaveConfigRecord = CompanyLeaveConfig & {
  company_id?: number;
  is_deleted?: boolean;
  created_by_name?: string;
  updated_by_name?: string;
};

export type UpdateLeaveConfigResponse = {
  success: boolean;
  message: string;
  data?: UpdateLeaveConfigRecord;
};

export type DeleteLeaveConfigResponse = {
  success: boolean;
  message: string;
};
