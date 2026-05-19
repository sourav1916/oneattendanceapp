import axios from 'axios';

import type { LoginType, VerifyLoginOtpBody } from '@src/types/loginAuth';
import type { AuthContinuePlatform } from '@src/utils/authPlatform';
import { API_ENDPOINT } from '../utils/config';

export type VerifyLoginOtpParams = {
  loginType: LoginType;
  password: string;
  otp: string;
  platform: AuthContinuePlatform;
  latitude: number;
  longitude: number;
  email?: string;
  phone?: string;
};

/**
 * POST `/auth/login/verify-otp` — location and platform are required.
 * Uses plain `axios` (not `authHttpClient`) so a 401 never triggers session teardown.
 */
export function verifyLoginOtp(params: VerifyLoginOtpParams) {
  const data: VerifyLoginOtpBody = {
    login_type: params.loginType,
    password: params.password,
    otp: params.otp,
    platform: params.platform,
    latitude: params.latitude,
    longitude: params.longitude,
  };

  if (params.loginType === 'email') {
    data.email = params.email;
  } else {
    data.phone = params.phone;
  }

  return axios.request({
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_ENDPOINT}/auth/login/verify-otp`,
    headers: {
      'Content-Type': 'application/json',
    },
    data,
  });
}
