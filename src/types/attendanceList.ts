export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
  meta: AttendanceListMeta;
};

export type ApiError = {
  success: false;
  message: string;
  errors?: Record<string, unknown>;
};

export type AttendanceDayStatus =
  | 'present'
  | 'absent'
  | 'leave'
  | 'half_day'
  | 'unmarked';

export type AttendanceListParams = {
  type?: 'attendance';
  from_date?: string;
  to_date?: string;
  employee_id?: number;
  day_status?: AttendanceDayStatus | null;
  search?: string;
  page?: number;
  limit?: number;
};

export type AttendanceListCounts = {
  total_employees: number;
  present: number;
  absent: number;
  leave: number;
  half_day: number;
  unmarked: number;
  attendance_entries: number;
  break_entries: number;
};

export type AttendanceListFilters = {
  from_date: string;
  to_date: string;
  employee_id: number | null;
  day_status: AttendanceDayStatus | null;
  type: 'attendance';
  search: string;
};

export type AttendanceListMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  is_last_page: boolean;
  filters: AttendanceListFilters;
  counts: AttendanceListCounts;
};

export type PunchPayload = {
  time: string;
  method?: string;
  latitude?: number;
  longitude?: number;
  ip_address?: string;
};

export type AttendanceDayRecord = {
  attendance_id: number;
  type: 'attendance';
  attendance_date: string;
  day_status: AttendanceDayStatus;
  is_verified: boolean;
  is_deductible: boolean;
  is_overtime: boolean;
  remark: string | null;
  punch_in: PunchPayload | null;
  punch_out: PunchPayload | null;
  half_day_session?: 'first_half' | 'second_half';
  leave_type?: 'paid' | 'unpaid';
  leave_sub_type?: string;
};

export type ShiftInfo = {
  start_time: string;
  end_time: string;
  expected_work_minutes: number;
  allowed_break_minutes: number;
  grace_minutes: number;
};

export type EmployeeAttendanceCalculations = {
  worked_minutes: number;
  total_break_time: number;
};

export type LabeledValue = {
  value: string;
  label: string;
};

export type EmployeeAttendanceRow = {
  employee_id: number;
  employee_code: string;
  designation: LabeledValue;
  employment_type: LabeledValue;
  salary_type: LabeledValue;
  name: string;
  email: string;
  phone: string;
  profile_picture: string | null;
  status: string;
  joining_date: string | null;
  shift: ShiftInfo;
  attendances: AttendanceDayRecord[];
  breaks: [];
  calculations: EmployeeAttendanceCalculations;
};

export type AttendanceListResponse = ApiSuccess<EmployeeAttendanceRow[]> | ApiError;
