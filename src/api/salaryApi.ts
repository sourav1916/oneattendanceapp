import { authHttpClient } from '@src/api/authHttpClient';
import type {
  AssignSalaryPayload,
  AssignSalaryResponse,
  SalaryComponentsListResponse,
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
};
