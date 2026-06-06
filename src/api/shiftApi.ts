import { authHttpClient } from '@src/api/authHttpClient';
import type {
  EmployeeShiftsListResponse,
  FetchEmployeeShiftsParams,
} from '@src/types/employeeShifts';

function withCompany(companyId: number) {
  return { company: String(companyId) };
}

/** GET `/shift/employees-shifts` — Bearer + company header, SHIFT.MNG permission. */
export async function fetchEmployeeShifts(
  companyId: number,
  params: FetchEmployeeShiftsParams = {},
): Promise<EmployeeShiftsListResponse> {
  const query: Record<string, number | string> = {
    page: params.page ?? 1,
    limit: Math.min(params.limit ?? 20, 100),
  };

  if (params.year != null) {
    query.year = params.year;
  }
  if (params.month != null) {
    query.month = params.month;
  }
  const search = params.search?.trim();
  if (search) {
    query.search = search;
  }

  const { data } = await authHttpClient.get<EmployeeShiftsListResponse>(
    '/shifts/employees-shifts',
    { headers: withCompany(companyId), params: query },
  );
  return data;
}
