import type {
  CreateEmployeeBody,
  CreateEmployeeFormData,
  CreateEmployeeSignupType,
} from '@src/types/createEmployee';
import { getAuthContinuePlatform } from '@src/utils/authPlatform';
import { toShiftHHmmss } from '@src/utils/invitePackagePayload';
import type { LatLng } from '@src/screens/auth/optionalLocationCoords';

function durationHHmmToMinutes(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0]!, 10) || 0;
    const m = parseInt(parts[1]!, 10) || 0;
    return h * 60 + m;
  }
  return parseInt(trimmed, 10) || 0;
}

export type CreateEmployeeFormErrors = Partial<
  Record<
    | 'name'
    | 'shift_start'
    | 'shift_end'
    | 'joining_date',
    string
  >
>;

export function validateCreateEmployeeForm(
  form: CreateEmployeeFormData,
  messages: {
    name: string;
    shiftStart: string;
    shiftEnd: string;
  },
): CreateEmployeeFormErrors {
  const errors: CreateEmployeeFormErrors = {};
  if (form.name.trim().length < 3) {
    errors.name = messages.name;
  }
  if (!form.shift_start.trim()) {
    errors.shift_start = messages.shiftStart;
  }
  if (!form.shift_end.trim()) {
    errors.shift_end = messages.shiftEnd;
  }
  return errors;
}

export function buildCreateEmployeePayload(options: {
  signupType: CreateEmployeeSignupType;
  email: string;
  phone: string;
  otp: string;
  form: CreateEmployeeFormData;
  coords: LatLng | null;
}): CreateEmployeeBody {
  const { signupType, email, phone, otp, form, coords } = options;
  const weekends = form.weekends.map(w => w.toLowerCase());

  const payload: CreateEmployeeBody = {
    signup_type: signupType,
    otp: otp.trim(),
    name: form.name.trim(),
    platform: getAuthContinuePlatform(),
    shift_start: toShiftHHmmss(form.shift_start),
    shift_end: toShiftHHmmss(form.shift_end),
    break_minutes: durationHHmmToMinutes(form.break_minutes),
    grace_minutes: durationHHmmToMinutes(form.grace_minutes),
    weekends,
  };

  if (signupType === 'email') {
    payload.email = email.trim();
  } else {
    payload.phone = phone.trim();
  }

  if (form.joining_date.trim()) {
    payload.joining_date = form.joining_date.trim();
  }

  if (form.permission_package_id != null) {
    payload.permission_package_id = form.permission_package_id;
  }

  const designation = form.designation.trim();
  if (designation) {
    payload.designation = designation;
  }

  const employmentType = form.employment_type.trim();
  if (employmentType) {
    payload.employment_type = employmentType;
  }

  const salaryType = form.salary_type.trim();
  if (salaryType) {
    payload.salary_type = salaryType;
  }

  if (coords != null) {
    payload.latitude = coords.latitude;
    payload.longitude = coords.longitude;
  }

  return payload;
}
