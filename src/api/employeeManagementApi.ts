import { authHttpClient } from '@src/api/authHttpClient';
import type {
  ConstantsResponse,
  EmployeeDeletePayload,
  EmployeeDeleteResponse,
  EmployeeUpdatePayload,
  EmployeeUpdateResponse,
  PermissionPackagesResponse,
} from '@src/types/employeeManagement';
import type { PermissionPackageListResponse } from '@src/types/permissionPackageList';
import { mapPermissionPackagesList } from '@src/utils/mapPermissionPackages';

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
          limit: params.limit ?? 10,
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
