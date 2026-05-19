import axios from 'axios';

import type { AuthContinuePlatform } from '@src/utils/authPlatform';
import { API_ENDPOINT } from '@src/utils/config';

export type ContinueWithGooglePayload = {
  credential: string;
  platform: AuthContinuePlatform;
  latitude?: number;
  longitude?: number;
};

/**
 * POST `/auth/continue/google` — Google ID token + platform.
 * Uses plain `axios` (not `authHttpClient`) so a 401 never triggers session teardown.
 */
export function continueWithGoogle(payload: ContinueWithGooglePayload) {
  const data: Record<string, string | number> = {
    credential: payload.credential,
    platform: payload.platform,
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
    url: `${API_ENDPOINT}/auth/continue/google`,
    headers: {
      'Content-Type': 'application/json',
    },
    data,
  });
}
