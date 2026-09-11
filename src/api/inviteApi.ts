import { authHttpClient } from '@src/api/authHttpClient';
import type {
  InviteActionResponse,
  InviteListResponse,
  InviteLabeledValue,
  InviteRecord,
  InviteUser,
} from '@src/types/invite';

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
      return item;
    }
    if (item && typeof item === 'object' && 'day' in item) {
      const raw = item as { day?: string };
      return String(raw.day ?? 'unknown');
    }
    return String(item);
  });
}

function normalizeAttendanceMethods(methods: unknown): InviteRecord['attendance_methods'] {
  if (!Array.isArray(methods)) {
    return [];
  }

  return methods.map(item => {
    if (typeof item === 'string') {
      return item;
    }
    if (item && typeof item === 'object' && 'method' in item) {
      const raw = item as { method?: string; is_auto?: boolean };
      return String(raw.method ?? 'unknown');
    }
    return String(item);
  });
}

function normalizeLabeledField(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'label' in value) {
    return String((value as InviteLabeledValue).label ?? 'N/A');
  }
  return String(value);
}

function normalizeInviteUser(user: unknown): InviteUser {
  if (!user || typeof user !== 'object') {
    return { name: 'N/A', email: null, phone: null, profile_picture: null };
  }

  const raw = user as InviteUser & { id?: number | string; profile_picture?: string | null; phone?: string | null; email?: string | null; name?: string };
  return {
    id: raw.id,
    name: raw.name ?? 'N/A',
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    profile_picture: raw.profile_picture ?? null,
  };
}

function normalizeCompany(record: Record<string, unknown>): InviteRecord['company'] {
  const raw = record.company as Record<string, unknown> | undefined;
  const companyName = typeof raw?.name === 'string' ? raw.name : 'N/A';
  return {
    id: typeof raw?.id === 'number' || typeof raw?.id === 'string' ? raw.id : undefined,
    name: companyName,
    logo_url: typeof raw?.logo_url === 'string' ? raw.logo_url : null,
    city: typeof raw?.city === 'string' ? raw.city : null,
    state: typeof raw?.state === 'string' ? raw.state : null,
    country: typeof raw?.country === 'string' ? raw.country : null,
    address_line1: typeof raw?.address_line1 === 'string' ? raw.address_line1 : null,
    address_line2: typeof raw?.address_line2 === 'string' ? raw.address_line2 : null,
    postal_code: typeof raw?.postal_code === 'string' ? raw.postal_code : null,
  } as InviteRecord['company'];
}

function normalizeInviteRecord(record: InviteRecord): InviteRecord {
  const normalizedRecord = {
    ...record,
    company: normalizeCompany(record as unknown as Record<string, unknown>),
    invited_by: normalizeInviteUser(record.invited_by),
    designation: normalizeLabeledField(record.designation),
    employment_type: normalizeLabeledField(record.employment_type),
    salary_type: normalizeLabeledField(record.salary_type),
    weekends: normalizeWeekends(record.weekends),
    attendance_methods: normalizeAttendanceMethods(record.attendance_methods),
  };

  return normalizedRecord;
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
