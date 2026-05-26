import axios from 'axios';

import { authHttpClient } from '@src/api/authHttpClient';
import { isValidEmail } from '@src/utils/loginIdentifier';
import { readApiError } from '@src/utils/readApiError';

type ApiSuccess<T> = { success: true; message: string; data?: T };

type ApiFail = { success: false; message: string; error?: string };

export class UpdateEmailError extends Error {
  readonly status: number;
  readonly isDuplicateEmail: boolean;
  readonly isRateLimited: boolean;
  readonly needsRegisteredPhone: boolean;

  constructor(
    status: number,
    message: string,
    flags?: {
      isDuplicateEmail?: boolean;
      isRateLimited?: boolean;
      needsRegisteredPhone?: boolean;
    },
  ) {
    super(message);
    this.name = 'UpdateEmailError';
    this.status = status;
    this.isDuplicateEmail = flags?.isDuplicateEmail ?? status === 409;
    this.isRateLimited = flags?.isRateLimited ?? status === 429;
    this.needsRegisteredPhone =
      flags?.needsRegisteredPhone ??
      (status === 400 && /registered phone/i.test(message));
  }
}

function normalizeEmailInput(email: string): string {
  return email.trim().toLowerCase();
}

function throwMappedAxiosError(e: unknown): never {
  if (!axios.isAxiosError(e)) {
    throw e;
  }
  const status = e.response?.status ?? 0;
  const bodyMsg = readApiError(e).trim() || 'Request failed';

  const needsRegisteredPhone =
    status === 400 && /registered phone/i.test(bodyMsg);

  throw new UpdateEmailError(status, bodyMsg, {
    isDuplicateEmail: status === 409,
    isRateLimited: status === 429,
    needsRegisteredPhone,
  });
}

function assertEmail(email: string): string {
  const normalized = normalizeEmailInput(email);
  if (!isValidEmail(normalized)) {
    throw new UpdateEmailError(400, 'Invalid email address');
  }
  return normalized;
}

/** POST `/users/request-update-email-otp` */
export async function requestUpdateEmailOtp(email: string): Promise<{ message: string }> {
  const normalized = assertEmail(email);

  try {
    const { data } = await authHttpClient.post<ApiSuccess<unknown> | ApiFail>(
      '/users/request-update-email-otp',
      { email: normalized },
    );

    if (data && typeof data === 'object' && data.success === true) {
      return {
        message: data.message?.trim() || 'OTP sent to your registered phone number',
      };
    }

    const fail = data as ApiFail | undefined;
    throw new UpdateEmailError(400, fail?.message?.trim() || 'Failed to send email update OTP');
  } catch (e) {
    if (e instanceof UpdateEmailError) {
      throw e;
    }
    throwMappedAxiosError(e);
  }
}

/** PUT `/users/verify-update-email-otp` */
export async function verifyUpdateEmailOtp(
  email: string,
  otp: string,
): Promise<{ message: string; email: string }> {
  const normalized = assertEmail(email);
  const otpTrim = otp.trim();
  if (!otpTrim) {
    throw new UpdateEmailError(400, 'OTP is required');
  }

  try {
    const { data } = await authHttpClient.put<ApiSuccess<{ email?: string }> | ApiFail>(
      '/users/verify-update-email-otp',
      { email: normalized, otp: otpTrim },
    );

    if (data && typeof data === 'object' && data.success === true) {
      const ok = data as ApiSuccess<{ email?: string }>;
      const saved =
        ok.data?.email != null && String(ok.data.email).trim()
          ? normalizeEmailInput(String(ok.data.email))
          : normalized;
      return {
        message: ok.message?.trim() || 'Email updated successfully',
        email: saved,
      };
    }

    const fail = data as ApiFail | undefined;
    throw new UpdateEmailError(400, fail?.message?.trim() || 'Failed to update email address');
  } catch (e) {
    if (e instanceof UpdateEmailError) {
      throw e;
    }
    throwMappedAxiosError(e);
  }
}
