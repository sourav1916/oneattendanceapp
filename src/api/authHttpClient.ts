import axios, { type AxiosInstance } from 'axios';

import { API_ENDPOINT } from '@src/utils/config';

/**
 * Authenticated API transport: attaches Bearer from `getAccessToken`, and on **401**
 * runs `onUnauthorized` once (typically `signOut` → clears storage → root shows login).
 *
 * **Do not use** for public routes (login, OTP, register, password reset). Use `axios`
 * or a dedicated client there so a 401 does not wipe the session.
 */
export type ConfigureAuthHttpClientOptions = {
  getAccessToken: () => string | null | undefined;
  onUnauthorized: () => Promise<void>;
};

let getAccessToken: () => string | null | undefined = () => null;
let onUnauthorized: () => Promise<void> = async () => {
  /* configured from AuthProvider */
};

let handling401 = false;

export function configureAuthHttpClient(options: ConfigureAuthHttpClientOptions): void {
  getAccessToken = options.getAccessToken;
  onUnauthorized = options.onUnauthorized;
}

export const authHttpClient: AxiosInstance = axios.create({
  baseURL: API_ENDPOINT,
  timeout: 30_000,
});

authHttpClient.interceptors.request.use(config => {
  const t = getAccessToken()?.trim();
  if (t) {
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

authHttpClient.interceptors.response.use(
  res => res,
  async err => {
    if (!axios.isAxiosError(err) || err.response?.status !== 401) {
      return Promise.reject(err);
    }
    if (handling401) {
      return Promise.reject(err);
    }
    handling401 = true;
    try {
      await onUnauthorized();
    } catch {
      /* still reject below */
    } finally {
      handling401 = false;
    }
    return Promise.reject(err);
  },
);