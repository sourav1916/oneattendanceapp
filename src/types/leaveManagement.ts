export type ApproveEditLeavePayload = {
  id: number;
  start_date?: string;
  end_date?: string;
  is_half_day?: boolean | 0 | 1;
  half_day_type?: 'first_half' | 'second_half' | null;
};

export type ApprovedLeaveBalance = {
  total_allocated: number;
  used: number;
  remaining: number;
};

export type ApprovedLeaveRecord = {
  id: number;
  company_id: number;
  employee_id: number;
  leave_config_id: number;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day: number | boolean;
  half_day_type: 'first_half' | 'second_half' | null;
  reason: string;
  status: string;
  approved_by: number;
  approved_at: string;
  approval_remarks: string | null;
  applied_at: string;
  created_at: string;
  leave_type_name?: string;
  leave_type_code?: string;
  leave_name?: string;
  leave_code?: string;
  employee_code: string;
  employee_name: string;
  employee_email: string;
};

export type ApproveEditLeaveResponse = {
  success: boolean;
  message: string;
  data?: {
    leave_ids: number[];
    total_days: number;
    leaves: ApprovedLeaveRecord[];
    balance: ApprovedLeaveBalance | null;
  };
};

export type BulkLeaveAction = 'approve' | 'reject';

export type BulkLeaveActionPayload = {
  ids: number[] | 'all';
  action: BulkLeaveAction;
  remarks?: string | null;
};

export type BulkLeaveActionResponse = {
  success: boolean;
  message: string;
  data?: {
    action: BulkLeaveAction;
    processed_count: number;
    leave_ids: number[];
    leaves: ApprovedLeaveRecord[];
  };
};

export type RejectLeavePayload = {
  id: number;
  remarks?: string | null;
};

export type RejectLeaveResponse = {
  success: boolean;
  message: string;
  data?: {
    leave?: Record<string, unknown>;
    leave_id?: number;
    status?: string;
  };
};

export type CreateManagementLeavePayload = {
  employee_id: number;
  leave_config_id: number;
  start_date: string;
  end_date: string;
  is_half_day?: boolean | 0 | 1;
  half_day_type?: 'first_half' | 'second_half' | null;
  reason?: string | null;
  remarks?: string | null;
  attachments?: string[];
};

export type CreatedManagementLeaveRecord = {
  id: number;
  company_id: number;
  employee_id: number;
  leave_config_id: number;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day: number | boolean;
  half_day_type: 'first_half' | 'second_half' | null;
  reason: string | null;
  status: string;
  approved_at: string;
  created_at: string;
  leave_type_name?: string;
  leave_type_code?: string;
  employee_code?: string;
  employee_name?: string;
  employee_email?: string;
};

export type CreateManagementLeaveAttachment = {
  id: number;
  leave_id: number;
  file_url: string;
  mime_type: string;
  file_size: number;
};

export type CreateManagementLeaveResponse = {
  success: boolean;
  message: string;
  data?: {
    total_days: number;
    total_leave_rows: number;
    leave_ids: number[];
    leaves: CreatedManagementLeaveRecord[];
    attachments: CreateManagementLeaveAttachment[];
  };
};
