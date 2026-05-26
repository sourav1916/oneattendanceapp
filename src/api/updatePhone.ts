import axios from 'axios';

import { authHttpClient } from '@src/api/authHttpClient';
import { readApiError } from '@src/utils/readApiError';
import { onlyDigits } from '@src/utils/profileEditForm';

type ApiSuccess<T> = { success: true; message: string; data?: T };

type ApiFail = { success: false; message: string; error?: string };

export class UpdatePhoneError extends Error {
  readonly status: number;
  readonly isDuplicatePhone: boolean;
  readonly isRateLimited: boolean;
  readonly needsRegisteredEmail: boolean;

  constructor(
    status: number,
    message: string,
    flags?: { isDuplicatePhone?: boolean; isRateLimited?: boolean; needsRegisteredEmail?: boolean },
  ) {
    super(message);
    this.name = 'UpdatePhoneError';
    this.status = status;
    this.isDuplicatePhone = flags?.isDuplicatePhone ?? status === 409;
    this.isRateLimited = flags?.isRateLimited ?? status === 429;
    this.needsRegisteredEmail =
      flags?.needsRegisteredEmail ??
      (status === 400 && /registered email/i.test(message));
  }
}

function normalizePhoneInput(phone: string): string {
  return onlyDigits(phone);
}

function throwMappedAxiosError(e: unknown): never {
  if (!axios.isAxiosError(e)) {
    throw e;
  }
  const status = e.response?.status ?? 0;
  const bodyMsg = readApiError(e).trim() || 'Request failed';

  const needsRegisteredEmail =
    status === 400 && /registered email/i.test(bodyMsg);

  throw new UpdatePhoneError(status, bodyMsg, {
    isDuplicatePhone: status === 409,
    isRateLimited: status === 429,
    needsRegisteredEmail,
  });
}

function assertPhoneDigits(phone: string): string {
  const digits = normalizePhoneInput(phone);
  if (digits.length < 10) {
    throw new UpdatePhoneError(400, 'Invalid phone number');
  }
  return digits;
}

/** POST `/users/request-update-phone-otp` */
export async function requestUpdatePhoneOtp(phone: string): Promise<{ message: string }> {
  const normalized = assertPhoneDigits(phone);

  try {
    const { data } = await authHttpClient.post<ApiSuccess<unknown> | ApiFail>(
      '/users/request-update-phone-otp',
      { phone: normalized },
    );

    if (data && typeof data === 'object' && data.success === true) {
      return {
        message: data.message?.trim() || 'OTP sent to your registered email',
      };
    }

    const fail = data as ApiFail | undefined;
    throw new UpdatePhoneError(400, fail?.message?.trim() || 'Failed to send phone update OTP');
  } catch (e) {
    if (e instanceof UpdatePhoneError) {
      throw e;
    }
    throwMappedAxiosError(e);
  }
}

/** PUT `/users/verify-update-phone-otp` */
export async function verifyUpdatePhoneOtp(
  phone: string,
  otp: string,
): Promise<{ message: string; phone: string }> {
  const normalized = assertPhoneDigits(phone);
  const otpTrim = otp.trim();
  if (!otpTrim) {
    throw new UpdatePhoneError(400, 'OTP is required');
  }

  try {
    const { data } = await authHttpClient.put<ApiSuccess<{ phone?: string }> | ApiFail>(
      '/users/verify-update-phone-otp',
      { phone: normalized, otp: otpTrim },
    );

    if (data && typeof data === 'object' && data.success === true) {
      const ok = data as ApiSuccess<{ phone?: string }>;
      const saved =
        ok.data?.phone != null && String(ok.data.phone).trim()
          ? normalizePhoneInput(String(ok.data.phone))
          : normalized;
      return {
        message: ok.message?.trim() || 'Phone number updated successfully',
        phone: saved,
      };
    }

    const fail = data as ApiFail | undefined;
    throw new UpdatePhoneError(400, fail?.message?.trim() || 'Failed to update phone number');
  } catch (e) {
    if (e instanceof UpdatePhoneError) {
      throw e;
    }
    throwMappedAxiosError(e);
  }
}
