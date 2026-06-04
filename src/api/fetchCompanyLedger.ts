import { authHttpClient } from '@src/api/authHttpClient';
import type {
  CompanyLedgerResponse,
  LedgerTransactionType,
} from '@src/types/companyLedger';

export type FetchCompanyLedgerParams = {
  page_no: number;
  limit: number;
  search?: string;
  from_date?: string;
  to_date?: string;
  employee_id?: number;
  transaction_type?: LedgerTransactionType;
};

function withCompany(companyId: number) {
  return { company: String(companyId) };
}

/** GET `/transactions/company-ledger` — requires `company` header. */
export async function fetchCompanyLedger(
  companyId: number,
  params: FetchCompanyLedgerParams,
): Promise<CompanyLedgerResponse> {
  const query: Record<string, string | number> = {
    page_no: params.page_no,
    limit: params.limit,
  };

  const search = params.search?.trim();
  if (search) {
    query.search = search;
  }
  if (params.from_date && params.to_date) {
    query.from_date = params.from_date;
    query.to_date = params.to_date;
  }
  if (params.employee_id != null) {
    query.employee_id = params.employee_id;
  }
  if (params.transaction_type) {
    query.transaction_type = params.transaction_type;
  }

  const { data } = await authHttpClient.get<CompanyLedgerResponse>(
    '/transactions/company-ledger',
    {
      headers: withCompany(companyId),
      params: query,
    },
  );
  return data;
}
