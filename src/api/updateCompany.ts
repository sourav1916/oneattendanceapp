import { authHttpClient } from '@src/api/authHttpClient';
import type { UpdateCompanyPayload, UpdateCompanyResponse } from '@src/types/updateCompany';

/** PUT `/company/update` — Bearer auth, owner only. Partial update. */
export async function updateCompany(
  body: UpdateCompanyPayload,
): Promise<UpdateCompanyResponse> {
  const { data } = await authHttpClient.put<UpdateCompanyResponse>('/company/update', body);
  return data;
}
