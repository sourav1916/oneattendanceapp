export type CompanyInviteSendPayload = {
  user_id: number;
  permission_package_id: number;
  employment_type: string;
  salary_type: string;
  designation: string;
  attendance_methods: string[];
  auto_approve: boolean;
  shift_start: string;
  shift_end: string;
  break_minutes: string;
  grace_minutes: string;
  weekends: string[];
};

export type CompanyInviteSendResponse = {
  success: boolean;
  message: string;
  errors?: Record<string, string>;
};
