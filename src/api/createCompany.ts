import { authHttpClient } from '@src/api/authHttpClient';
import type { CreateCompanyBody, CreateCompanyResponse } from '@src/types/createCompany';

/** POST `/company/create` — Bearer auth. */
export async function createCompany(body: CreateCompanyBody): Promise<CreateCompanyResponse> {
  const { data } = await authHttpClient.post<CreateCompanyResponse>('/company/create', body);
  return data;
}
