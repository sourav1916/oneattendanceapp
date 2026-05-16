import { authHttpClient } from '@src/api/authHttpClient';
import type { ActiveSessionsResponse } from '@src/types/activeSessions';

/** GET `/auth/sessions` — Bearer from {@link authHttpClient}. */
export async function fetchActiveSessions(): Promise<ActiveSessionsResponse> {
  const { data } = await authHttpClient.get<ActiveSessionsResponse>('/auth/sessions', {
    maxBodyLength: Infinity,
  });
  return data;
}
