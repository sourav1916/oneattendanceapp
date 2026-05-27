export type LabeledValue = {
  value: string;
  label: string;
};

export type InvitePackagePermission = {
  id: number;
  action: string;
  code: string;
  name: string;
};

export type InvitePackageItem = {
  id: number;
  code: string;
  name: string;
  designation: LabeledValue | null;
  employment_type: LabeledValue | null;
  salary_type: LabeledValue | null;
  permission_package_id: number | null;
  permission_package_name: string | null;
  shift_start: string | null;
  shift_end: string | null;
  break_minutes: number | null;
  grace_minutes: number | null;
  weekends: string[];
  attendance_methods: string[];
  auto_approve: boolean;
  is_active: boolean;
  remarks?: string | null;
  permissions: InvitePackagePermission[];
};

export type InvitePackageListMeta = {
  total: number;
  total_pages: number;
  page: number;
  limit: number;
  is_last_page: boolean;
};

export type InvitePackageListResponse = {
  success: boolean;
  message: string;
  data: InvitePackageItem[] | null;
  meta: InvitePackageListMeta | null;
};

export type InvitePackageCreatePayload = {
  code: string;
  name: string;
  designation?: string;
  employment_type?: string;
  salary_type?: string;
  permission_package_id?: number;
  shift_start: string;
  shift_end: string;
  break_minutes: string;
  grace_minutes: string;
  weekends: string[];
  attendance_methods: string[];
  auto_approve: boolean;
  is_active: boolean;
  remarks?: string;
};

export type InvitePackageUpdatePayload = {
  package_id: number;
  name?: string;
  designation?: string;
  employment_type?: string;
  salary_type?: string;
  permission_package_id?: number | null;
  shift_start?: string | null;
  shift_end?: string | null;
  break_minutes?: string | null;
  grace_minutes?: string | null;
  weekends?: string[];
  attendance_methods?: string[];
  auto_approve?: boolean;
  is_active?: boolean;
  remarks?: string | null;
};

export type InvitePackageMutationResponse = {
  success: boolean;
  message: string;
};

export type InvitePackageFormData = {
  code: string;
  name: string;
  designation: string;
  employment_type: string;
  salary_type: string;
  permission_package_id: number | null;
  shift_start: string;
  shift_end: string;
  break_minutes: string;
  grace_minutes: string;
  weekends: string[];
  attendance_methods: string[];
  auto_approve: boolean;
  remarks: string;
};
