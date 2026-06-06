import { authHttpClient } from '@src/api/authHttpClient';
import type {
  GeneratePayrollRequest,
  GeneratePayrollResponse,
} from '@src/types/generatePayroll';
import type {
  FetchPayrollListParams,
  PayrollListResponse,
} from '@src/types/payrollList';

function withCompany(companyId: number) {
  return { company: String(companyId) };
}

/** GET `/payroll/list` — Bearer + company header, PAY.MNG permission. */
export async function fetchPayrollList(
  companyId: number,
  params: FetchPayrollListParams,
): Promise<PayrollListResponse> {
  const query: Record<string, number> = {
    month: params.month,
    year: params.year,
    page: params.page ?? 1,
    limit: Math.min(params.limit ?? 20, 100),
  };
  if (params.employee_id != null) {
    query.employee_id = params.employee_id;
  }

  const { data } = await authHttpClient.get<PayrollListResponse>('/payroll/list', {
    headers: withCompany(companyId),
    params: query,
  });
  return data;
}

/** POST `/payroll/generate-payroll` — Bearer + company header, PAY.MNG permission. */
export async function generatePayroll(
  companyId: number,
  body: GeneratePayrollRequest,
): Promise<GeneratePayrollResponse> {
  const { data } = await authHttpClient.post<GeneratePayrollResponse>(
    '/payroll/generate-payroll',
    body,
    { headers: withCompany(companyId) },
  );
  return data;
}
