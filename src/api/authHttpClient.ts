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

let handlingUnauthorized = false;

export function configureAuthHttpClient(options: ConfigureAuthHttpClientOptions): void {
  getAccessToken = options.getAccessToken;
  onUnauthorized = options.onUnauthorized;
}

export const authHttpClient: AxiosInstance = axios.create({
  baseURL: API_ENDPOINT,
  timeout: 30_000,
  headers: {
    Accept: 'application/json',
  },
});

authHttpClient.interceptors.request.use(config => {
  // Older builds could persist the complete "Bearer <token>" value. Do not
  // send a duplicated scheme because the server will reject that session.
  const rawToken = getAccessToken()?.trim();
  const t = rawToken?.replace(/^Bearer\s+/i, '').trim();
  if (t) {
    config.headers.Authorization = 'Bearer ' + t;
  }
  return config;
});

authHttpClient.interceptors.response.use(
  res => res,
  async err => {
    if (!axios.isAxiosError(err)) {
      return Promise.reject(err);
    }

    const status = err.response?.status;
    const requestUrl = err.config?.url ?? '';
    const isProfileRoleRequest =
      requestUrl === '/users/profile-role' ||
      requestUrl.endsWith('/users/profile-role');

    // Profile loading is the app's session validation request. A 403 there
    // means the stored session cannot be used, regardless of the server's
    // response wording, so clear it rather than leaving the app stuck.
    if (status !== 401 && !(status === 403 && isProfileRoleRequest)) {
      return Promise.reject(err);
    }
    if (handlingUnauthorized) {
      return Promise.reject(err);
    }
    handlingUnauthorized = true;
    try {
      await onUnauthorized();
    } catch {
      /* still reject below */
    } finally {
      handlingUnauthorized = false;
    }
    return Promise.reject(err);
  },
);