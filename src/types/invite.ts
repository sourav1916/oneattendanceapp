export type InviteStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export type InviteLabeledValue = {
  value: string;
  label: string;
};

export type InviteCompany = {
  id?: number | string;
  name: string;
  logo_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
};

export type InviteUser = {
  id?: number | string;
  name: string;
  email: string | null;
  phone?: string | null;
  profile_picture: string | null;
};

export type InvitePermissionPackage = {
  id: number | string;
  name: string;
};

export type InviteWeekend = string | { day: string };

export type InvitePermission = {
  id: string | number;
  name: string;
  code?: string;
};

export type InviteAttendanceMethod = string | { method: string; is_auto?: boolean };

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
  company_id?: number | string;
  status: InviteStatus;
  created_at: string;
  expires_at: string;
  company: InviteCompany;
  invited_by: InviteUser;
  designation: InviteLabeledValue | string | null;
  employment_type: InviteLabeledValue | string | null;
  salary_type: InviteLabeledValue | string | null;
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
  permission_package?: InvitePermissionPackage | null;
  auto_approve?: boolean;
  enable_overtime?: boolean;
  enable_deduction?: boolean;
  is_active?: boolean;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | number | null;
};

export type InviteApiWeekendRaw = string | { day: string };
export type InviteApiAttendanceMethodRaw = string | { method: string; is_auto?: boolean };


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
