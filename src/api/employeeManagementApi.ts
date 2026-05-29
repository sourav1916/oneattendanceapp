import { authHttpClient } from '@src/api/authHttpClient';
import type {
  ConstantsResponse,
  EmployeeDeletePayload,
  EmployeeDeleteResponse,
  EmployeeUpdatePayload,
  EmployeeUpdateResponse,
  PermissionPackage,
  PermissionPackagesResponse,
} from '@src/types/employeeManagement';
import type { PermissionPackageListResponse } from '@src/types/permissionPackageList';
import { mapPermissionPackagesList } from '@src/utils/mapPermissionPackages';

export const FORM_OPTIONS_PAGE_LIMIT = 100;

function withCompany(companyId: number) {
  return { company: String(companyId) };
}

export const employeeManagementApi = {
  async getConstants(companyId: number): Promise<ConstantsResponse> {
    const { data } = await authHttpClient.get<ConstantsResponse>(
      '/constants/',
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async getPermissionPackages(
    companyId: number,
    params: { search?: string; page?: number; limit?: number } = {},
  ): Promise<PermissionPackagesResponse> {
    const { data } = await authHttpClient.get<PermissionPackageListResponse>(
      '/permissions/permission-packages',
      {
        headers: withCompany(companyId),
        params: {
          search: params.search ?? '',
          page: params.page ?? 1,
          limit: params.limit ?? FORM_OPTIONS_PAGE_LIMIT,
        },
      },
    );
    const packages = data.data?.packages;
    return {
      success: data.success,
      message: data.message,
      data:
        data.success && packages != null
          ? mapPermissionPackagesList(packages)
          : null,
    };
  },

  /** Loads every active permission package page for edit/update dropdowns. */
  async getAllPermissionPackages(
    companyId: number,
  ): Promise<PermissionPackagesResponse> {
    const merged: PermissionPackage[] = [];
    let page = 1;
    let lastMessage = '';

    while (true) {
      const { data } = await authHttpClient.get<PermissionPackageListResponse>(
        '/permissions/permission-packages',
        {
          headers: withCompany(companyId),
          params: {
            search: '',
            page,
            limit: FORM_OPTIONS_PAGE_LIMIT,
          },
        },
      );

      lastMessage = data.message ?? '';

      if (!data.success) {
        return {
          success: false,
          message: lastMessage || 'Could not load permission packages.',
          data: merged.length > 0 ? merged : null,
        };
      }

      const packages = data.data?.packages;
      if (packages != null) {
        merged.push(...mapPermissionPackagesList(packages));
      }

      const meta = data.data?.meta;
      const isLast =
        meta?.is_last_page === true ||
        (meta != null &&
          meta.totalPages > 0 &&
          page >= meta.totalPages) ||
        packages == null ||
        packages.length === 0;

      if (isLast) {
        return {
          success: true,
          message: lastMessage,
          data: merged,
        };
      }

      page += 1;
    }
  },

  async updateEmployee(
    companyId: number,
    payload: EmployeeUpdatePayload,
  ): Promise<EmployeeUpdateResponse> {
    const { data } = await authHttpClient.put<EmployeeUpdateResponse>(
      '/employees/update',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async deleteEmployee(
    companyId: number,
    payload: EmployeeDeletePayload,
  ): Promise<EmployeeDeleteResponse> {
    const { data } = await authHttpClient.delete<EmployeeDeleteResponse>(
      '/employees/delete',
      { headers: withCompany(companyId), data: payload },
    );
    return data;
  },
};
