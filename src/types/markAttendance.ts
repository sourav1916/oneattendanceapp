export type MarkAttendanceType = 'attendance' | 'break';

export type MarkAttendanceStatus = 'present' | 'half_day' | 'absent' | 'leave';

export type HalfDayType = 'first_half' | 'second_half';

export type LeaveType = 'paid' | 'unpaid';

export type MarkAttendancePayload = {
  employee_id: number;
  date: string;
  type?: MarkAttendanceType;
  status?: MarkAttendanceStatus;
  start_time?: string | null;
  end_time?: string | null;
  is_deductible?: boolean;
  is_overtime?: boolean;
  half_day_type?: HalfDayType | null;
  leave_type?: LeaveType | null;
  leave_type_value?: string | null;
  leave_day_overtime?: number;
  notes?: string | null;
};

export type MarkAttendanceResponse = {
  success: boolean;
  message: string;
};

export type BulkApproveMode = 'actual' | 'present' | 'half_day' | 'leave' | 'absent';

export type BulkApprovePayload = {
  attendance_date: string;
  employee_ids: number[] | 'all';
  attendance_type: 'attendance';
  mode: BulkApproveMode;
  notes?: string;
  half_day_type?: HalfDayType;
  leave_type?: LeaveType;
  leave_type_value?: string;
};

export type BulkApproveResponse = {
  success: boolean;
  message: string;
};

export type LeaveConfigEntry = {
  id: number;
  code: string;
  name: string;
  is_paid: boolean;
};

export type LeaveConfigResponse = {
  success: boolean;
  message: string;
  data: LeaveConfigEntry[] | null;
};
