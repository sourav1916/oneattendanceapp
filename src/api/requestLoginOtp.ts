import axios from 'axios';

import { API_ENDPOINT } from '../utils/config';

/**
 * POST `/auth/login/request-otp` — same body as email + password login.
 * Uses plain `axios` (not `authHttpClient`) so a 401 never triggers session teardown.
 */
export function requestLoginOtp(email: string, password: string) {
  return axios.request({
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_ENDPOINT}/auth/login/request-otp`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: { email, password },
  });
}
