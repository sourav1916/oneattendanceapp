import { authHttpClient } from '@src/api/authHttpClient';
import type { InviteActionResponse, InviteListResponse } from '@src/types/invite';

export type InviteListParams = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
};

export const inviteApi = {
  async getMyInvites(params: InviteListParams = {}): Promise<InviteListResponse> {
    const { data } = await authHttpClient.get<InviteListResponse>(
      '/company/invites/my',
      {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 10,
          ...(params.status && params.status !== 'all' ? { status: params.status } : {}),
          ...(params.search?.trim() ? { search: params.search.trim() } : {}),
        },
      },
    );
    return data;
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
