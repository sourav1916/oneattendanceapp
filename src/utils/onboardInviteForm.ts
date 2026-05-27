import type { InvitePackageItem } from '@src/types/invitePackage';
import type { OnboardInviteFormData } from '@src/types/onboardInvite';

function stripSeconds(hhmmss: string | null, fallback: string): string {
  if (!hhmmss) {
    return fallback;
  }
  const m = hhmmss.match(/^(\d{1,2}:\d{2})/);
  return m ? m[1]! : fallback;
}

function minutesToDuration(totalMinutes: number | null): string {
  if (totalMinutes == null || !Number.isFinite(totalMinutes)) {
    return '00:30';
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const EMPTY_ONBOARD_INVITE_FORM: OnboardInviteFormData = {
  permission_package_id: null,
  designation: '',
  employment_type: '',
  salary_type: '',
  shift_start: '09:00',
  shift_end: '18:00',
  break_minutes: '00:30',
  grace_minutes: '00:15',
  weekends: [],
  attendance_methods: [],
  auto_approve: false,
};

export function buildOnboardFormFromPackage(
  pkg: InvitePackageItem,
): OnboardInviteFormData {
  return {
    permission_package_id: pkg.permission_package_id,
    designation: pkg.designation?.value ?? '',
    employment_type: pkg.employment_type?.value ?? '',
    salary_type: pkg.salary_type?.value ?? '',
    shift_start: stripSeconds(pkg.shift_start, '09:00'),
    shift_end: stripSeconds(pkg.shift_end, '18:00'),
    break_minutes: minutesToDuration(pkg.break_minutes),
    grace_minutes: minutesToDuration(pkg.grace_minutes),
    weekends: (pkg.weekends ?? []).map(w => w.toLowerCase()),
    attendance_methods: [...(pkg.attendance_methods ?? [])],
    auto_approve: pkg.auto_approve,
  };
}

export type OnboardInviteFormErrors = Partial<
  Record<
    | 'permission_package_id'
    | 'designation'
    | 'employment_type'
    | 'salary_type'
    | 'attendance_methods'
    | 'shift_start'
    | 'shift_end'
    | 'break_minutes'
    | 'grace_minutes',
    string
  >
>;

export function validateOnboardInviteForm(
  form: OnboardInviteFormData,
  messages: {
    permissionPackage: string;
    designation: string;
    employmentType: string;
    salaryType: string;
    attendanceMethods: string;
    shiftStart: string;
    shiftEnd: string;
  },
): OnboardInviteFormErrors {
  const errors: OnboardInviteFormErrors = {};
  if (form.permission_package_id == null) {
    errors.permission_package_id = messages.permissionPackage;
  }
  if (!form.designation.trim()) {
    errors.designation = messages.designation;
  }
  if (!form.employment_type.trim()) {
    errors.employment_type = messages.employmentType;
  }
  if (!form.salary_type.trim()) {
    errors.salary_type = messages.salaryType;
  }
  const methods = Array.isArray(form.attendance_methods)
    ? form.attendance_methods
    : [];
  if (methods.length === 0) {
    errors.attendance_methods = messages.attendanceMethods;
  }
  if (!form.shift_start.trim()) {
    errors.shift_start = messages.shiftStart;
  }
  if (!form.shift_end.trim()) {
    errors.shift_end = messages.shiftEnd;
  }
  return errors;
}
