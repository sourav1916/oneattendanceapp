import axios from 'axios';

import type { AuthContinuePlatform } from '@src/utils/authPlatform';
import { API_ENDPOINT } from '@src/utils/config';

export type ContinueWithTruecallerPayload = {
  code: string;
  code_verifier: string;
  platform: AuthContinuePlatform;
  latitude?: number;
  longitude?: number;
};

/**
 * POST `/auth/continue/truecaller` — OAuth authorization code + PKCE verifier.
 * Uses plain `axios` (not `authHttpClient`) so a 401 never triggers session teardown.
 */
export function continueWithTruecaller(payload: ContinueWithTruecallerPayload) {
  const data: Record<string, string | number> = {
    code: payload.code,
    code_verifier: payload.code_verifier,
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
    url: `${API_ENDPOINT}/auth/continue/truecaller`,
    headers: {
      'Content-Type': 'application/json',
    },
    data,
  });
}
