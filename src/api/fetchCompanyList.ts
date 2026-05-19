import { authHttpClient } from '@src/api/authHttpClient';
import type { CompanyListResponse } from '@src/types/companyList';

export type FetchCompanyListParams = {
  search?: string;
  page?: number;
  limit?: number;
};

const DEFAULT_LIMIT = 20;

/** GET `/company/list` — Bearer auth, paginated company search. */
export async function fetchCompanyList(
  params: FetchCompanyListParams = {},
): Promise<CompanyListResponse> {
  const page = params.page ?? 1;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const search = params.search?.trim() ?? '';

  const { data } = await authHttpClient.get<CompanyListResponse>('/company/list', {
    params: {
      page,
      limit,
      ...(search.length > 0 ? { search } : {}),
    },
  });
  return data;
}
