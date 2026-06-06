export type PayrollEnumField = {
  value: string;
  label: string;
};

export type PayrollEmployee = {
  id: number;
  name: string;
  email: string;
  profile_picture: string | null;
  employee_code: string;
  designation: PayrollEnumField | null;
  employment_type: PayrollEnumField | null;
  salary_type: PayrollEnumField | null;
};

export type PayrollAttendanceSnapshot = {
  working_days: number;
  present_days: number;
  absent_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
};

export type PayrollWorkSnapshot = {
  worked_minutes: number;
  overtime_minutes: number;
  deduction_minutes: number;
};

export type PayrollComponentLine = {
  name: string;
  amount: number;
};

export type PayrollComponentsBreakdown = {
  earnings: PayrollComponentLine[];
  deductions: PayrollComponentLine[];
};

export type PayrollAdjustment = {
  type: string;
  name?: string;
  amount: number;
  remark?: string;
};

export type GeneratedPayrollData = {
  id: number;
  month: number;
  year: number;
  net_salary: number;
  total_earnings: number;
  total_deductions: number;
  attendance: PayrollAttendanceSnapshot;
  work: PayrollWorkSnapshot;
  components_breakdown: PayrollComponentsBreakdown;
  adjustments: PayrollAdjustment[];
};

export type PreviewPayrollData = Omit<GeneratedPayrollData, 'id'> & {
  id?: never;
};

export type GeneratedPayrollRow = {
  employee: PayrollEmployee;
  payroll: GeneratedPayrollData;
};

export type PreviewPayrollRow = {
  employee: PayrollEmployee;
  payroll: PreviewPayrollData;
};

export type PayrollListData = {
  generated_payrolls: GeneratedPayrollRow[];
  preview_payrolls: PreviewPayrollRow[];
};

export type PayrollListMeta = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type PayrollListResponse = {
  success: boolean;
  message: string;
  data: PayrollListData | null;
  meta: PayrollListMeta | null;
};

export type FetchPayrollListParams = {
  month: number;
  year: number;
  employee_id?: number;
  page?: number;
  limit?: number;
};

export type PayrollListKind = 'generated' | 'preview';

export type PayrollListDisplayRow = {
  kind: PayrollListKind;
  employee: PayrollEmployee;
  payroll: GeneratedPayrollData | PreviewPayrollData;
};
