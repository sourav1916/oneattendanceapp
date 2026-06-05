import { authHttpClient } from '@src/api/authHttpClient';
import type { SubscriptionPackagesResponse } from '@src/types/subscriptionPackage';

function withCompanyHeader(companyId: number) {
  return { company: String(companyId) };
}

/** GET `/subscriptions/packages` — Bearer + `company` header. */
export async function fetchSubscriptionPackages(
  companyId: number,
): Promise<SubscriptionPackagesResponse> {
  const { data } = await authHttpClient.get<SubscriptionPackagesResponse>(
    '/subscriptions/packages',
    { headers: withCompanyHeader(companyId) },
  );
  return data;
}
