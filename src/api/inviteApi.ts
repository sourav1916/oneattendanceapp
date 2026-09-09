import { authHttpClient } from '@src/api/authHttpClient';
import type { InviteActionResponse, InviteListResponse, InviteRecord } from '@src/types/invite';

export type InviteListParams = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
};

const ALLOWED_MY_INVITE_STATUSES = new Set([
  'pending',
  'accepted',
  'rejected',
  'expired',
]);

function normalizeWeekends(weekends: unknown): InviteRecord['weekends'] {
  if (!Array.isArray(weekends)) {
    return [];
  }

  return weekends.map(item => {
    if (typeof item === 'string') {
      return { day: item, type: 'full' };
    }
    if (item && typeof item === 'object' && 'day' in item) {
      const raw = item as { day?: string; type?: string };
      return {
        day: String(raw.day ?? 'unknown'),
        type: raw.type ?? 'full',
      };
    }
    return { day: String(item), type: 'full' };
  });
}

function normalizeAttendanceMethods(methods: unknown): InviteRecord['attendance_methods'] {
  if (!Array.isArray(methods)) {
    return [];
  }

  return methods.map(item => {
    if (typeof item === 'string') {
      return { method: item, is_auto: false };
    }
    if (item && typeof item === 'object' && 'method' in item) {
      const raw = item as { method?: string; is_auto?: boolean };
      return {
        method: String(raw.method ?? 'unknown'),
        is_auto: Boolean(raw.is_auto),
      };
    }
    return { method: String(item), is_auto: false };
  });
}

function normalizeInviteRecord(record: InviteRecord): InviteRecord {
  return {
    ...record,
    weekends: normalizeWeekends(record.weekends),
    attendance_methods: normalizeAttendanceMethods(record.attendance_methods),
  };
}

export const inviteApi = {
  async getMyInvites(params: InviteListParams = {}): Promise<InviteListResponse> {
    const requestedStatus = params.status?.trim().toLowerCase();
    const normalizedStatus =
      requestedStatus && requestedStatus !== 'all' && ALLOWED_MY_INVITE_STATUSES.has(requestedStatus)
        ? requestedStatus
        : undefined;

    const { data } = await authHttpClient.get<InviteListResponse>(
      '/company/invites/my',
      {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 10,
          ...(normalizedStatus ? { status: normalizedStatus } : {}),
          ...(params.search?.trim() ? { search: params.search.trim() } : {}),
        },
      },
    );

    if (!Array.isArray(data?.data)) {
      return data;
    }

    return {
      ...data,
      data: data.data.map(record => normalizeInviteRecord(record as InviteRecord)),
    };
  },

  async accept(token: string): Promise<InviteActionResponse> {
    const { data } = await authHttpClient.post<InviteActionResponse>(
      '/company/invites/accept',
      { token },
    );
    return data;
  },

  async reject(token: string): Promise<InviteActionResponse> {
    const { data } = await authHttpClient.put<InviteActionResponse>(
      '/company/invites/reject',
      { token },
    );
    return data;
  },
};
