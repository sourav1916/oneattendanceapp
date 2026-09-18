import { authHttpClient } from '@src/api/authHttpClient';
import type {
  AssignSalaryPayload,
  AssignSalaryResponse,
  FetchMySalaryParams,
  MySalaryResponse,
  SalaryComponentsListResponse,
  SalaryPackagesListResponse,
} from '@src/types/salary';

function withCompany(companyId: number) {
  return { company: String(companyId) };
}

export const salaryApi = {
  async listComponents(companyId: number): Promise<SalaryComponentsListResponse> {
    const { data } = await authHttpClient.get<SalaryComponentsListResponse>(
      '/salary/components/list',
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async listPackages(companyId: number): Promise<SalaryPackagesListResponse> {
    const { data } = await authHttpClient.get<SalaryPackagesListResponse>(
      '/salary/components/packages',
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async assignSalary(
    companyId: number,
    payload: AssignSalaryPayload,
  ): Promise<AssignSalaryResponse> {
    const { data } = await authHttpClient.post<AssignSalaryResponse>(
      '/salary/assign-salary',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async getMySalary(
    companyId: number,
    params?: FetchMySalaryParams,
  ): Promise<MySalaryResponse> {
    const { data } = await authHttpClient.get<MySalaryResponse>(
      '/salary/my-salary',
      {
        headers: withCompany(companyId),
        params: {
          ...(params?.month != null ? { month: params.month } : {}),
          ...(params?.year != null ? { year: params.year } : {}),
        },
      },
    );
    return data;
  },
};
