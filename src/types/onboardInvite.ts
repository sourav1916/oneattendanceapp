export type OnboardInviteFormData = {
  permission_package_id: number | null;
  designation: string;
  employment_type: string;
  salary_type: string;
  shift_start: string;
  shift_end: string;
  break_minutes: string;
  grace_minutes: string;
  weekends: string[];
  attendance_methods: string[];
  auto_approve: boolean;
};
