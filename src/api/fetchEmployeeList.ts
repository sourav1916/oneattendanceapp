import { authHttpClient } from '@src/api/authHttpClient';
import type { EmployeeListResponse } from '@src/types/employeeList';

export type FetchEmployeeListParams = {
  search?: string;
  page?: number;
  limit?: number;
};

const DEFAULT_LIMIT = 20;

/** GET `/employees/list` — Bearer + `company` header (company id). */
export async function fetchEmployeeList(
  companyId: number,
  params: FetchEmployeeListParams = {},
): Promise<EmployeeListResponse> {
  const page = params.page ?? 1;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const search = params.search?.trim() ?? '';

  const { data } = await authHttpClient.get<EmployeeListResponse>('/employees/list', {
    headers: {
      company: String(companyId),
    },
    params: {
      page,
      limit,
      ...(search.length > 0 ? { search } : {}),
    },
  });


  return data;

}
