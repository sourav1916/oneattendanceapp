import axios from 'axios';

import type {
  SignupPlatform,
  VerifySignupOtpBody,
  VerifySignupOtpEmailBody,
  VerifySignupOtpPhoneBody,
} from '@src/types/signupAuth';
import { API_ENDPOINT } from '../utils/config';
import { normalizeSignupPhoneDigits } from '../utils/signupValidation';

type VerifySignupOtpBaseParams = {
  password: string;
  otp: string;
  name?: string;
  platform: SignupPlatform;
  latitude?: number;
  longitude?: number;
};

export type VerifySignupOtpParams =
  | (VerifySignupOtpBaseParams & {
      signupType: 'email';
      email: string;
    })
  | (VerifySignupOtpBaseParams & {
      signupType: 'phone';
      phone: string;
    });

function appendOptionalFields(
  data: VerifySignupOtpEmailBody | VerifySignupOtpPhoneBody,
  params: VerifySignupOtpBaseParams,
): VerifySignupOtpBody {
  if (params.name?.trim()) {
    data.name = params.name.trim();
  }
  if (
    typeof params.latitude === 'number' &&
    typeof params.longitude === 'number' &&
    Number.isFinite(params.latitude) &&
    Number.isFinite(params.longitude)
  ) {
    data.latitude = params.latitude;
    data.longitude = params.longitude;
  }
  return data;
}

/** POST `/auth/signup/verify-otp` — email or phone only (never both). */
export function verifySignupOtp(params: VerifySignupOtpParams) {
  let data: VerifySignupOtpBody;

  if (params.signupType === 'email') {
    data = appendOptionalFields(
      {
        signup_type: 'email',
        email: params.email.trim().toLowerCase(),
        otp: params.otp.trim(),
        password: params.password,
        platform: params.platform,
      },
      params,
    );
  } else {
    data = appendOptionalFields(
      {
        signup_type: 'phone',
        phone: normalizeSignupPhoneDigits(params.phone),
        otp: params.otp.trim(),
        password: params.password,
        platform: params.platform,
      },
      params,
    );
  }

  return axios.request({
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_ENDPOINT}/auth/signup/verify-otp`,
    headers: { 'Content-Type': 'application/json' },
    data,
  });
}
