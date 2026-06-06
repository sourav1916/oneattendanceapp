export type EmployeeShiftEnumField = {
  value: string;
  label: string;
};

export type EmployeeShiftMonthlySummary = {
  present_days: number;
  absent_days: number;
  leave_days: number;
  holiday_days: number;
  weekend_days: number;
  worked_minutes: number;
  break_minutes: number;
  overtime_minutes: number;
};

export type EmployeeShiftRow = {
  employee_id: number;
  employee_code: string;
  name: string;
  designation: EmployeeShiftEnumField | null;
  employment_type: EmployeeShiftEnumField | null;
  salary_type: EmployeeShiftEnumField | null;
  status: boolean;
  joining_date: string;
  email: string;
  phone: string;
  profile_picture: string | null;
  expected_work_minutes: number;
  expected_break_minutes: number;
  grace_minutes: number;
  weekends: string[];
  monthly_summary: EmployeeShiftMonthlySummary;
};

export type EmployeeShiftsFilters = {
  year: number;
  month: number;
  search: string | null;
};

export type EmployeeShiftsPageCounts = {
  employees: number;
  present_days: number;
  absent_days: number;
  leave_days: number;
  holiday_days: number;
  weekend_days: number;
  worked_minutes: number;
  break_minutes: number;
  overtime_minutes: number;
};

export type EmployeeShiftsMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  is_last_page: boolean;
  filters: EmployeeShiftsFilters;
  counts: EmployeeShiftsPageCounts;
};

export type EmployeeShiftsListResponse = {
  success: boolean;
  message: string;
  data: EmployeeShiftRow[] | null;
  meta: EmployeeShiftsMeta | null;
};

export type FetchEmployeeShiftsParams = {
  year?: number;
  month?: number;
  page?: number;
  limit?: number;
  search?: string;
};
