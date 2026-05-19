import axios from 'axios';

import type { LoginType, RequestLoginOtpBody } from '@src/types/loginAuth';
import { API_ENDPOINT } from '../utils/config';

export type RequestLoginOtpParams = {
  loginType: LoginType;
  password: string;
  email?: string;
  phone?: string;
};

/**
 * POST `/auth/login/request-otp`
 * Sends `email` or `phone` based on `login_type` (never both).
 * Uses plain `axios` (not `authHttpClient`) so a 401 never triggers session teardown.
 */
export function requestLoginOtp(params: RequestLoginOtpParams) {
  const data: RequestLoginOtpBody = {
    login_type: params.loginType,
    password: params.password,
  };

  if (params.loginType === 'email') {
    data.email = params.email;
  } else {
    data.phone = params.phone;
  }

  return axios.request({
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_ENDPOINT}/auth/login/request-otp`,
    headers: {
      'Content-Type': 'application/json',
    },
    data,
  });
}
