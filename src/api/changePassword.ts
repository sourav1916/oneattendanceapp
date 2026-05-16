import { authHttpClient } from '@src/api/authHttpClient';
import type { ChangePasswordResponse } from '@src/types/changePassword';

export type ChangePasswordBody = {
  current_password: string;
  new_password: string;
  /** When `true`, other devices stay signed in; when `false`, other sessions are ended. */
  keep_other_sessions: boolean;
};

/**
 * POST `/auth/change-password` — authenticated; body matches typical backend shape.
 * Adjust path/body keys if your API differs.
 */
export async function changePassword(body: ChangePasswordBody): Promise<ChangePasswordResponse> {
  const { data } = await authHttpClient.post<ChangePasswordResponse>(
    '/auth/change-password',
    body,
    { maxBodyLength: Infinity },
  );
  return data;
}
