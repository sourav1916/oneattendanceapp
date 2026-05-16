export type LeaveBalanceEntry = {
  leave_config_id: number;
  code: string;
  is_paid: boolean;
  allow_half_day: boolean;
  carry_forward_limit: number;
  exclude_weekends: boolean;
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
