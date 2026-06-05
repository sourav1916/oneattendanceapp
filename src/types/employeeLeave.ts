export type EmpLeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type EmpLeaveAttachment = {
  id: number;
  file_url: string;
  file_type: string;
  file_size: number;
};

export type EmployeeLeaveRow = {
  id: number;
  employee_id: number;
  leave_config_id: number;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day: boolean;
  half_day_type: 'first_half' | 'second_half' | null;
  reason: string;
  status: EmpLeaveStatus;
  approved_by: number | null;
  approved_at: string | null;
  approval_remarks: string | null;
  applied_at: string;
  cancelled_at: string | null;
  created_at: string;
  employee_code: string;
  designation: string;
  employee_name: string;
  email: string;
  profile_picture: string | null;
  leave_code: string;
  leave_name: string;
  is_paid: boolean;
  approved_by_name: string | null;
  attachments: EmpLeaveAttachment[];
};

export type EmpLeaveListMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type EmpLeaveListResponse = {
  success: boolean;
  message?: string | Array<{ field?: string; message: string }>;
  data: EmployeeLeaveRow[] | null;
  meta: EmpLeaveListMeta | null;
};

export type FetchEmpLeavesParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: EmpLeaveStatus | '';
  start_date?: string;
  end_date?: string;
};
