import type {
  InvitePackageCreatePayload,
  InvitePackageFormData,
} from '@src/types/invitePackage';

/** Shift time for API: `HH:mm:ss` */
export function toShiftHHmmss(value: string): string {
  const trimmed = value.trim();
  const parts = trimmed.split(':');
  if (parts.length === 2) {
    const h = parts[0]!.padStart(2, '0');
    const m = parts[1]!.padStart(2, '0');
    return `${h}:${m}:00`;
  }
  if (parts.length === 3) {
    const h = parts[0]!.padStart(2, '0');
    const m = parts[1]!.padStart(2, '0');
    const s = parts[2]!.padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  return trimmed;
}

/** Break / grace duration for API: `HH:mm` (e.g. `01:00`, `00:15`) */
export function toDurationHHmm(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '00:00';
  }
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    const h = parts[0]!.padStart(2, '0');
    const m = parts[1]!.padStart(2, '0');
    return `${h}:${m}`;
  }
  return trimmed;
}

export function buildInvitePackageCreatePayload(
  form: InvitePackageFormData,
): InvitePackageCreatePayload {
  const attendanceMethods = Array.isArray(form.attendance_methods)
    ? form.attendance_methods
    : [];
  const weekends = Array.isArray(form.weekends)
    ? form.weekends.map(w => w.toLowerCase())
    : [];

  const payload: InvitePackageCreatePayload = {
    code: form.code.trim(),
    name: form.name.trim(),
    shift_start: toShiftHHmmss(form.shift_start),
    shift_end: toShiftHHmmss(form.shift_end),
    break_minutes: toDurationHHmm(form.break_minutes),
    grace_minutes: toDurationHHmm(form.grace_minutes),
    weekends,
    attendance_methods: attendanceMethods,
    auto_approve: form.auto_approve,
    is_active: true,
  };

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

  if (form.permission_package_id != null) {
    payload.permission_package_id = form.permission_package_id;
  }

  const remarks = form.remarks.trim();
  if (remarks) {
    payload.remarks = remarks;
  }

  return payload;
}
