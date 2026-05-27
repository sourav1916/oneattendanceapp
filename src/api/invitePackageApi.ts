import { authHttpClient } from '@src/api/authHttpClient';
import type {
  CompanyInviteActionResponse,
  CompanyInviteListResponse,
} from '@src/types/companyInvite';
import type { CompanyInviteSendPayload, CompanyInviteSendResponse } from '@src/types/companyInviteSend';
import type {
  InvitePackageCreatePayload,
  InvitePackageListResponse,
  InvitePackageMutationResponse,
  InvitePackageUpdatePayload,
} from '@src/types/invitePackage';

function withCompany(companyId: number) {
  return { company: String(companyId) };
}

export type ListParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export const invitePackageApi = {
  async list(
    companyId: number,
    params: ListParams = {},
  ): Promise<InvitePackageListResponse> {
    const { data } = await authHttpClient.get<InvitePackageListResponse>(
      '/company/invites/package-list',
      {
        headers: withCompany(companyId),
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 10,
          ...(params.search?.trim() ? { search: params.search.trim() } : {}),
        },
      },
    );
    return data;
  },

  async create(
    companyId: number,
    payload: InvitePackageCreatePayload,
  ): Promise<InvitePackageMutationResponse> {
    const { data } = await authHttpClient.post<InvitePackageMutationResponse>(
      '/company/invites/package-create',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async update(
    companyId: number,
    payload: InvitePackageUpdatePayload,
  ): Promise<InvitePackageMutationResponse> {
    const { data } = await authHttpClient.put<InvitePackageMutationResponse>(
      '/company/invites/package-update',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async remove(
    companyId: number,
    packageId: number,
  ): Promise<InvitePackageMutationResponse> {
    const { data } =
      await authHttpClient.delete<InvitePackageMutationResponse>(
        '/company/invites/package-delete',
        { headers: withCompany(companyId), data: { package_id: packageId } },
      );
    return data;
  },
};

export const companyInviteApi = {
  async list(
    companyId: number,
    params: ListParams = {},
  ): Promise<CompanyInviteListResponse> {
    const { data } = await authHttpClient.get<CompanyInviteListResponse>(
      '/company/invites/list',
      {
        headers: withCompany(companyId),
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 10,
          ...(params.search?.trim() ? { search: params.search.trim() } : {}),
        },
      },
    );
    return data;
  },

  async cancel(
    companyId: number,
    token: string,
  ): Promise<CompanyInviteActionResponse> {
    const { data } =
      await authHttpClient.delete<CompanyInviteActionResponse>(
        '/company/invites/cancel',
        { headers: withCompany(companyId), data: { token } },
      );
    return data;
  },

  async resend(
    companyId: number,
    inviteId: number,
  ): Promise<CompanyInviteActionResponse> {
    const { data } =
      await authHttpClient.post<CompanyInviteActionResponse>(
        '/company/invites/resend',
        { invite_id: inviteId },
        { headers: withCompany(companyId) },
      );
    return data;
  },

  async send(
    companyId: number,
    payload: CompanyInviteSendPayload,
  ): Promise<CompanyInviteSendResponse> {
    const { data } = await authHttpClient.post<CompanyInviteSendResponse>(
      '/company/invites/send',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },
};
