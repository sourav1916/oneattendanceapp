import type { LabeledValue } from '@src/types/invitePackage';

export type CompanyInviteUser = {
  id: number;
  name: string;
  email: string | null;
  profile_picture: string | null;
};

export type CompanyInviteInvitedBy = {
  id: number;
  name: string;
};

export type CompanyInviteWeekend = {
  day: string;
  type: 'full' | 'half' | string;
};

export type CompanyInviteAttendanceMethod = {
  method: string;
  is_auto: boolean;
};

export type CompanyInvitePermission = {
  id: number;
  name: string;
  code: string;
};

export type CompanyInvitePermissionPackage = {
  id: number;
  name: string;
};

export type CompanyInviteStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type CompanyInviteDisplayStatus = CompanyInviteStatus | 'expired';

export type CompanyInviteItem = {
  invite_id: number;
  token: string;
  company_id: number;
  user: CompanyInviteUser;
  invited_by: CompanyInviteInvitedBy | null;
  designation: LabeledValue | null;
  employment_type: LabeledValue | null;
  salary_type: LabeledValue | null;
  status: CompanyInviteStatus;
  is_active: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: number | null;
  expires_at: string;
  created_at: string;
  shift_start: string | null;
  shift_end: string | null;
  break_minutes: number | null;
  grace_minutes: number | null;
  attendance_methods: CompanyInviteAttendanceMethod[];
  weekends: CompanyInviteWeekend[];
  permissions: CompanyInvitePermission[];
  permission_package: CompanyInvitePermissionPackage | null;
};

export type CompanyInviteListMeta = {
  total: number;
  total_pages: number;
  page: number;
  limit: number;
  is_last_page: boolean;
};

export type CompanyInviteListResponse = {
  success: boolean;
  message: string;
  data: CompanyInviteItem[] | null;
  meta: CompanyInviteListMeta | null;
};

export type CompanyInviteActionResponse = {
  success: boolean;
  message: string;
};
