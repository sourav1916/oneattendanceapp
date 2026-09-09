export type InviteStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export type InviteCompany = {
  name: string;
  logo_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

export type InviteUser = {
  name: string;
  email: string | null;
  phone: string | null;
  profile_picture: string | null;
};

export type InviteWeekend = {
  day: string;
  type: string;
};

export type InvitePermission = {
  id: string;
  name: string;
};

export type InviteAttendanceMethod = {
  method: string;
  is_auto: boolean;
};

export type InviteSalaryComponent = {
  id?: string | number;
  component_id?: string | number;
  component_name?: string;
  component_code?: string;
  calc_type?: string;
  calc_value?: number | string | null;
  remark?: string | null;
  is_active?: boolean;
};

export type InviteRecord = {
  invite_id: string;
  invite_token: string;
  status: InviteStatus;
  created_at: string;
  expires_at: string;
  company: InviteCompany;
  invited_by: InviteUser;
  designation: string | null;
  employment_type: string | null;
  salary_type: string | null;
  shift_start: string | null;
  shift_end: string | null;
  break_minutes: string | number | null;
  grace_minutes: string | number | null;
  weekends: InviteWeekend[];
  permissions: InvitePermission[];
  attendance_methods: InviteAttendanceMethod[];
  base_amount?: number | string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  joining_date?: string | null;
  salary_components?: InviteSalaryComponent[];
};

export type InviteApiWeekendRaw = string | InviteWeekend;
export type InviteApiAttendanceMethodRaw = string | InviteAttendanceMethod;


export type InviteListResponse = {
  success: boolean;
  message?: string;
  data: InviteRecord[] | null;
  current_page?: number;
  page?: number;
  per_page?: number;
  limit?: number;
  total?: number;
  last_page?: number;
  total_pages?: number;
  is_last_page?: boolean;
  meta?: {
    total?: number;
    total_pages?: number;
    page?: number;
    limit?: number;
  };
};

export type InviteActionResponse = {
  success: boolean;
  message: string;
};
