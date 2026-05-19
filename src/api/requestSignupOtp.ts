import axios from 'axios';

import type { RequestSignupOtpBody, SignupType } from '@src/types/signupAuth';
import { API_ENDPOINT } from '../utils/config';
import { normalizeSignupPhoneDigits } from '../utils/signupValidation';

export type RequestSignupOtpParams =
  | {
      signupType: 'email';
      email: string;
    }
  | {
      signupType: 'phone';
      phone: string;
    };

/**
 * POST `/auth/signup/request-otp`
 * Email: email only. Phone: phone only (mutually exclusive).
 */
export function requestSignupOtp(params: RequestSignupOtpParams) {
  let data: RequestSignupOtpBody;

  if (params.signupType === 'email') {
    data = {
      signup_type: 'email',
      email: params.email.trim().toLowerCase(),
    };
  } else {
    data = {
      signup_type: 'phone',
      phone: normalizeSignupPhoneDigits(params.phone),
    };
  }

  return axios.request({
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_ENDPOINT}/auth/signup/request-otp`,
    headers: { 'Content-Type': 'application/json' },
    data,
  });
}

export function buildRequestSignupOtpParams(
  signupType: SignupType,
  email: string,
  phone: string,
): RequestSignupOtpParams {
  if (signupType === 'phone') {
    return {
      signupType: 'phone',
      phone: normalizeSignupPhoneDigits(phone),
    };
  }
  return {
    signupType: 'email',
    email: email.trim(),
  };
}
