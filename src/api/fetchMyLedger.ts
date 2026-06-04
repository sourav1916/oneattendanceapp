import { authHttpClient } from '@src/api/authHttpClient';
import type {
  CompanyLedgerResponse,
  LedgerTransactionType,
} from '@src/types/companyLedger';

export type FetchMyLedgerParams = {
  page_no: number;
  limit: number;
  search?: string;
  from_date?: string;
  to_date?: string;
  transaction_type?: LedgerTransactionType;
};

function withCompany(companyId: number) {
  return { company: String(companyId) };
}

/** GET `/transactions/my-ledger` — employee-only; requires `company` header. */
export async function fetchMyLedger(
  companyId: number,
  params: FetchMyLedgerParams,
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
  if (params.transaction_type) {
    query.transaction_type = params.transaction_type;
  }

  const { data } = await authHttpClient.get<CompanyLedgerResponse>(
    '/transactions/my-ledger',
    {
      headers: withCompany(companyId),
      params: query,
    },
  );
  return data;
}
