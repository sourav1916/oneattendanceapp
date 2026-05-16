import { authHttpClient } from '@src/api/authHttpClient';
import type { LogoutSessionResponse } from '@src/types/logoutSession';

/** POST `/auth/logout-session` — ends a single session by id. */
export async function logoutSession(sessionId: number): Promise<LogoutSessionResponse> {
  const { data } = await authHttpClient.post<LogoutSessionResponse>(
    '/auth/logout-session',
    { session_id: sessionId },
    { maxBodyLength: Infinity },
  );
  return data;
}
