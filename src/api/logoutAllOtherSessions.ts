import { authHttpClient } from '@src/api/authHttpClient';
import type { LogoutAllOtherSessionsResponse } from '@src/types/logoutAllOtherSessions';

/** POST `/auth/logout-all` — ends every session except the current one. */
export async function logoutAllOtherSessions(): Promise<LogoutAllOtherSessionsResponse> {
  const { data } = await authHttpClient.post<LogoutAllOtherSessionsResponse>(
    '/auth/logout-all',
    {},
    { maxBodyLength: Infinity },
  );
  return data;
}
