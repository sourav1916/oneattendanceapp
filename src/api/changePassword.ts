import { authHttpClient } from '@src/api/authHttpClient';
import type { ChangePasswordResponse } from '@src/types/changePassword';

export type ChangePasswordBody = {
  old_password: string;
  new_password: string;
  /** When `true`, keep the current session signed in (and typically other devices per backend policy). */
  keep_login: boolean;
};

/**
 * POST `/auth/change-password` — authenticated.
 */
export async function changePassword(body: ChangePasswordBody): Promise<ChangePasswordResponse> {
  const { data } = await authHttpClient.post<ChangePasswordResponse>(
    '/auth/change-password',
    body,
    { maxBodyLength: Infinity },
  );
  return data;
}
