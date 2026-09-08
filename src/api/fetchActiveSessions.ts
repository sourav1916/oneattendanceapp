import { authHttpClient } from '@src/api/authHttpClient';
import type {
  ActiveSessionsResponse,
  ActiveSessionsServerResponse,
  ActiveSessionsMeta,
} from '@src/types/activeSessions';

const DEFAULT_META: ActiveSessionsMeta = {
  page: 1,
  limit: 10,
  total: 0,
  total_pages: 1,
  is_last_page: true,
};

export function normalizeActiveSessionsPayload(
  payload: ActiveSessionsServerResponse | ActiveSessionsResponse,
): ActiveSessionsResponse {
  const array = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.sessions)
      ? payload.sessions
      : [];

  const meta = payload.meta ?? DEFAULT_META;
  return {
    success: payload.success,
    message: payload.message,
    sessions: array,
    meta: {
      ...DEFAULT_META,
      ...meta,
      total: typeof meta.total === 'number' ? meta.total : array.length,
      limit: typeof meta.limit === 'number' ? meta.limit : array.length,
    },
  };
}

/** GET `/auth/sessions` — Bearer from {@link authHttpClient}. */
export async function fetchActiveSessions(): Promise<ActiveSessionsResponse> {
  const { data } = await authHttpClient.get<ActiveSessionsServerResponse>('/auth/sessions', {
    maxBodyLength: Infinity,
  });

  return normalizeActiveSessionsPayload(data);
}
