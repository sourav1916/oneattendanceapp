import axios from 'axios';

import { API_ENDPOINT } from '../utils/config';

export type VerifyLoginOtpPayload = {
  email: string;
  otp: string;
  latitude?: number;
  longitude?: number;
};

/**
 * POST `/auth/login/verify-otp` — `latitude` / `longitude` only when available.
 * Uses plain `axios` (not `authHttpClient`) so a 401 never triggers session teardown.
 */
export function verifyLoginOtp(payload: VerifyLoginOtpPayload) {
  const data: Record<string, string | number> = {
    email: payload.email,
    otp: payload.otp,
  };
  if (
    typeof payload.latitude === 'number' &&
    typeof payload.longitude === 'number' &&
    Number.isFinite(payload.latitude) &&
    Number.isFinite(payload.longitude)
  ) {
    data.latitude = payload.latitude;
    data.longitude = payload.longitude;
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
