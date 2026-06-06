export type GeneratePayrollRequest = {
  employee_id?: number | number[];
  all_employees?: boolean;
  send_pdf?: boolean;
};

export type GeneratePayrollResultRow = {
  payroll_entry_id: number;
  employee_id: number;
  employee_name: string;
  employee_code: string;
  employee_email: string;
  net_salary: number;
  total_earnings: number;
  total_deductions: number;
};

export type GeneratePayrollEmailSentRow = {
  payroll_entry_id: number;
  employee_id: number;
  employee_name: string;
  email: string;
};

export type GeneratePayrollEmailFailedRow = {
  payroll_entry_id: number;
  employee_id: number;
  employee_name: string;
  error: string;
};

export type GeneratePayrollEmailSummary = {
  sent: number;
  failed: number;
  sent_list: GeneratePayrollEmailSentRow[];
  failed_list: GeneratePayrollEmailFailedRow[];
};

export type GeneratePayrollMeta = {
  processed_count: number;
  email_sent_count: number;
  email_failed_count: number;
};

export type GeneratePayrollResponse = {
  success: boolean;
  message: string;
  data: GeneratePayrollResultRow[] | null;
  email_summary: GeneratePayrollEmailSummary | null;
  meta: GeneratePayrollMeta | null;
};

export type GeneratePayrollScope = 'all' | 'preview' | 'selected';

export type GeneratePayrollEmployeeOption = {
  id: number;
  name: string;
  employeeCode: string;
  kind: 'generated' | 'preview';
};
