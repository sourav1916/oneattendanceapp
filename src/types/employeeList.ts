export type EmployeeListWeekend = {
  day: string;
  type: string;
};

export type EmployeeListPermission = {
  permission_id: number;
  code: string;
  name: string;
  action: string;
};

export type EmployeeListAttendanceMethod = {
  id: number;
  method: string;
  is_auto: boolean;
};

export type LabeledValue = {
  value: string;
  label: string;
} | string | null;

export type EmployeeListItem = {
  id: number;
  company_id: number;
  user_id: number;
  permission_package_id: number;
  employee_code: string;
  designation: LabeledValue;
  salary_type: LabeledValue;
  face_enrolled: boolean;
  fingerprint_mapped: boolean;
  joining_date: string;
  status: string;
  employment_type: LabeledValue;
  weekends: EmployeeListWeekend[];
  shift_start: string | null;
  shift_end: string | null;
  expected_work_minutes: number | null;
  break_minutes: number | null;
  grace_minutes: number | null;
  created_at: string;
  updated_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_system_admin: boolean;
  last_login: string | null;
  profile_picture: string | null;
  package_id: number;
  package_name: string | null;
  group_code: string | null;
  description: string | null;
  permissions: EmployeeListPermission[];
  attendance_methods: EmployeeListAttendanceMethod[];
};

export type EmployeeListMeta = {
  total: number;
  total_pages: number;
  page: number;
  limit: number;
  is_last_page: boolean;
  /** When the API returns workforce counts (optional until backend ships). */
  active?: number;
  inactive?: number;
};

export type EmployeeListResponse = {
  success: boolean;
  message: string;
  data: EmployeeListItem[] | null;
  meta: EmployeeListMeta | null;
};
