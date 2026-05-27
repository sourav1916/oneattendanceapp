import { authHttpClient } from '@src/api/authHttpClient';
import type { PermissionPackageListResponse } from '@src/types/permissionPackageList';
import type {
  PermissionListResponse,
  PermissionPackageCreatePayload,
  PermissionPackageCreateResponse,
  PermissionPackageDeletePayload,
  PermissionPackageMutationResponse,
  PermissionPackageUpdatePayload,
  PermissionPackageUpdateResponse,
} from '@src/types/permissionManagement';

function withCompany(companyId: number) {
  return { company: String(companyId) };
}

export type PermissionPackageListParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export const permissionManagementApi = {
  async listPermissions(): Promise<PermissionListResponse> {
    const { data } = await authHttpClient.get<PermissionListResponse>(
      '/permissions/list',
    );
    return data;
  },

  async listPackages(
    companyId: number,
    params: PermissionPackageListParams = {},
  ): Promise<PermissionPackageListResponse> {
    const { data } = await authHttpClient.get<PermissionPackageListResponse>(
      '/permissions/permission-packages',
      {
        headers: withCompany(companyId),
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 10,
          search: params.search ?? '',
        },
      },
    );
    return data;
  },

  async createPackage(
    companyId: number,
    payload: PermissionPackageCreatePayload,
  ): Promise<PermissionPackageCreateResponse> {
    const { data } = await authHttpClient.post<PermissionPackageCreateResponse>(
      '/permissions/create-package',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async updatePackage(
    companyId: number,
    payload: PermissionPackageUpdatePayload,
  ): Promise<PermissionPackageUpdateResponse> {
    const { data } = await authHttpClient.put<PermissionPackageUpdateResponse>(
      '/permissions/update-package',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async deletePackage(
    companyId: number,
    payload: PermissionPackageDeletePayload,
  ): Promise<PermissionPackageMutationResponse> {
    const { data } =
      await authHttpClient.delete<PermissionPackageMutationResponse>(
        '/permissions/delete-package',
        { headers: withCompany(companyId), data: payload },
      );
    return data;
  },
};
