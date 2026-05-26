export type LeaveBalanceEntry = {
  leave_config_id: number;
  code: string;
  name?: string;
  is_paid: boolean;
  allow_half_day: boolean;
  is_comp_off?: boolean;
  carry_forward_limit: number;
  exclude_weekends: boolean;
  allow_negative_balance?: boolean;
  total: number;
  used: number;
  remaining: number;
};

/** Keys are API-defined slugs (e.g. `casual_leave`). */
export type LeaveBalanceData = Record<string, LeaveBalanceEntry>;

export type LeaveBalanceResponse = {
  success: boolean;
  message: string;
  data: LeaveBalanceData | null;
};
