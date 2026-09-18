import type {
  CreateEmployeeBody,
  CreateEmployeeFormData,
  CreateEmployeeSignupType,
} from '@src/types/createEmployee';
import { getAuthContinuePlatform } from '@src/utils/authPlatform';
import { toShiftHHmmss } from '@src/utils/invitePackagePayload';
import type { LatLng } from '@src/utils/optionalLocationCoords';

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
    | 'permission_package_id'
    | 'designation'
    | 'employment_type'
    | 'salary_type'
    | 'base_amount'
    | 'effective_from'
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
    permissionPackage: string;
    designation: string;
    employmentType: string;
    salaryType: string;
    baseAmount: string;
    effectiveFrom: string;
    shiftStart: string;
    shiftEnd: string;
  },
): CreateEmployeeFormErrors {
  const errors: CreateEmployeeFormErrors = {};
  if (form.name.trim().length < 3) {
    errors.name = messages.name;
  }
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
  const baseAmount = Number(form.base_amount.trim());
  if (!form.base_amount.trim() || !Number.isFinite(baseAmount) || baseAmount <= 0) {
    errors.base_amount = messages.baseAmount;
  }
  if (!form.effective_from.trim()) {
    errors.effective_from = messages.effectiveFrom;
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
  includeSalary?: boolean;
}): CreateEmployeeBody {
  const {
    signupType,
    email,
    phone,
    otp,
    form,
    coords,
    includeSalary = true,
  } = options;
  if (form.permission_package_id == null) {
    throw new Error('Permission package is required to create an employee.');
  }
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
    permission_package_id: form.permission_package_id,
    designation: form.designation.trim(),
    employment_type: form.employment_type.trim(),
    salary_type: form.salary_type.trim(),
  };

  if (includeSalary) {
    payload.base_amount = Number(form.base_amount.trim());
    payload.effective_from = form.effective_from.trim();
    payload.components = (form.components || [])
      .filter(c => c.component_id && c.calc_value !== '')
      .map(c => ({
        component_id: Number(c.component_id),
        calc_type: c.calc_type,
        calc_value: parseFloat(c.calc_value) || 0,
        ...(c.effective_from ? { effective_from: c.effective_from } : {}),
        effective_to: c.effective_to || null,
        reason: c.reason || '',
      }));
  }

  if (signupType === 'email') {
    payload.email = email.trim();
  } else {
    payload.phone = phone.trim();
  }

  if (includeSalary && form.effective_to?.trim()) {
    payload.effective_to = form.effective_to.trim();
  }

  if (form.joining_date.trim()) {
    payload.joining_date = form.joining_date.trim();
  }

  if (coords != null) {
    payload.latitude = coords.latitude;
    payload.longitude = coords.longitude;
  }

  return payload;
}
