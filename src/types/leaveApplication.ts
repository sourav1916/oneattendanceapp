export type LeaveApplicationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type LeaveAttachment = {
  id: string;
  file_url: string;
  original_name: string;
  file_type: string;
};

export type LeaveApplication = {
  id: string;
  leave_type_id: string;
  leave_type_name: string;
  is_paid: boolean;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day: boolean;
  half_day_type: 'first_half' | 'second_half' | null;
  reason: string;
  status: LeaveApplicationStatus;
  applied_at: string;
  approval_remarks: string;
  attachments: LeaveAttachment[];
};

export type LeaveApplicationListMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type LeaveApplicationListResponse = {
  success: boolean;
  message?: string;
  data: LeaveApplication[] | null;
  meta: LeaveApplicationListMeta | null;
};

export type ApplyLeaveApiPayload = {
  leave_config_id: string | number;
  start_date: string;
  end_date: string;
  is_half_day: 0 | 1;
  half_day_type?: 'first_half' | 'second_half';
  reason: string;
  attachments?: string[];
};

export type UpdateLeaveApiPayload = {
  id: string;
  leave_config_id: string | number;
  start_date: string;
  end_date: string;
  is_half_day: 0 | 1;
  half_day_type?: 'first_half' | 'second_half';
  reason: string;
  attachments?: string[];
  deleted_attachments?: string[];
};

export type CancelLeavePayload = {
  id: string;
  remarks: string;
};

export type LeaveApiResponse = {
  success: boolean;
  message: string;
};

export type DerivedLeaveType = {
  id: string;
  name: string;
  code: string;
  is_paid: boolean;
  allow_half_day: boolean;
  remaining: number;
  total: number;
  used: number;
};
