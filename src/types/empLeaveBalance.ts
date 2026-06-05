export type EmpLeaveBalanceType = {
  leave_config_id: number;
  type: string;
  name: string;
  total_allocated: number;
  used: number;
  remaining: number;
  is_paid: boolean;
  allow_half_day: boolean;
  max_balance: number | null;
  carry_forward_limit: number;
  exclude_weekends: boolean;
};

export type EmpLeaveBalanceEmployee = {
  employee_id: number;
  employee_name: string;
  email: string;
  mobile: string | null;
  profile_picture: string | null;
  employee_code: string;
  leaves: EmpLeaveBalanceType[];
};

export type EmpLeaveBalanceMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type EmpLeaveBalanceListResponse = {
  success: boolean;
  message: string;
  data: EmpLeaveBalanceEmployee[] | null;
  meta: EmpLeaveBalanceMeta | null;
};

export type FetchEmpLeaveBalancesParams = {
  year?: number;
  page?: number;
  limit?: number;
  search?: string;
};

export type LeaveBalanceMutationItem = {
  leave_config_id: number;
  total_allocated: number;
};

export type AssignLeaveBalancePayload = {
  employee_id: number;
  leaves: LeaveBalanceMutationItem[];
};

export type UpdateLeaveBalancePayload = {
  employee_id: number;
  leaves: LeaveBalanceMutationItem[];
};

export type DeleteLeaveBalancePayload = {
  employee_id: number;
  leave_config_id: number;
};

export type LeaveBalanceMutationRecord = {
  id: number;
  company_id?: number;
  employee_id: number;
  leave_config_id: number;
  year: number;
  total_allocated: number;
  used: number;
  remaining: number;
  is_active?: number;
  created_at?: string;
  updated_at?: string;
  code: string;
  name: string;
  is_paid: boolean;
  allow_half_day: boolean;
  max_balance: number | null;
  carry_forward_limit: number;
  exclude_weekends: boolean;
};

export type AssignLeaveBalanceResponse = {
  success: boolean;
  message: string;
  count?: number;
  data?: LeaveBalanceMutationRecord[];
};

export type UpdateLeaveBalanceResponse = {
  success: boolean;
  message: string;
  count?: number;
  data?: LeaveBalanceMutationRecord[];
};

export type DeleteLeaveBalanceResponse = {
  success: boolean;
  message: string;
};
