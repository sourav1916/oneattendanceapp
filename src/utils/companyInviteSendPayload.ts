import axios from 'axios';

import type { CompanyInviteSendPayload, CompanyInviteSendResponse } from '@src/types/companyInviteSend';
import type { OnboardInviteFormData } from '@src/types/onboardInvite';
import { toDurationHHmm, toShiftHHmmss } from '@src/utils/invitePackagePayload';
import { readApiError } from '@src/utils/readApiError';

export function buildCompanyInviteSendPayload(
  userId: number,
  form: OnboardInviteFormData,
): CompanyInviteSendPayload {
  const weekends = Array.isArray(form.weekends)
    ? form.weekends.map(w => w.toLowerCase())
    : [];
  const attendanceMethods = Array.isArray(form.attendance_methods)
    ? form.attendance_methods
    : [];

  return {
    user_id: userId,
    permission_package_id: form.permission_package_id!,
    employment_type: form.employment_type.trim(),
    salary_type: form.salary_type.trim(),
    designation: form.designation.trim(),
    attendance_methods: attendanceMethods,
    auto_approve: form.auto_approve,
    shift_start: toShiftHHmmss(form.shift_start),
    shift_end: toShiftHHmmss(form.shift_end),
    break_minutes: toDurationHHmm(form.break_minutes),
    grace_minutes: toDurationHHmm(form.grace_minutes),
    weekends,
  };
}

export function formatInviteSendError(
  res: CompanyInviteSendResponse | undefined,
  fallback: string,
): string {
  if (!res) {
    return fallback;
  }
  if (res.errors && typeof res.errors === 'object') {
    const parts = Object.values(res.errors).filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0,
    );
    if (parts.length > 0) {
      return parts.join(' ');
    }
  }
  return res.message?.trim() || fallback;
}

export function readInviteSendFailure(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && err.response?.data) {
    return formatInviteSendError(
      err.response.data as CompanyInviteSendResponse,
      fallback,
    );
  }
  return readApiError(err);
}
