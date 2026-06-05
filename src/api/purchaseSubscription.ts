import { authHttpClient } from '@src/api/authHttpClient';
import type {
  PurchaseSubscriptionPayload,
  PurchaseSubscriptionResponse,
} from '@src/types/subscriptionPackage';

function withCompanyHeader(companyId: number) {
  return { company: String(companyId) };
}

/** POST `/subscriptions/purchase-subscription` — company owner only. */
export async function purchaseSubscription(
  companyId: number,
  payload: PurchaseSubscriptionPayload,
): Promise<PurchaseSubscriptionResponse> {
  const { data } = await authHttpClient.post<PurchaseSubscriptionResponse>(
    '/subscriptions/purchase-subscription',
    payload,
    { headers: withCompanyHeader(companyId) },
  );
  return data;
}
