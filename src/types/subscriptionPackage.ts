export type SubscriptionPeriod =
  | 'monthly'
  | 'quarterly'
  | 'half_yearly'
  | 'yearly';

export type SubscriptionPackage = {
  id: number;
  name: string;
  min_employee_count: number;
  max_employee_count: number;
  monthly_price?: number;
  quarterly_price?: number;
  half_yearly_price?: number;
  yearly_price?: number;
};

export type SubscriptionPackagesResponse = {
  success: boolean;
  message?: string;
  data?: SubscriptionPackage[] | null;
};

export type PurchaseSubscriptionPayload = {
  package_id: number;
  package_period: SubscriptionPeriod;
};

export type PurchaseSubscriptionPaymentData = {
  /** Same token as web `Layer.checkout({ token: layer_token })`. */
  layer_token?: string;
  payment_token?: string;
};

export type PurchaseSubscriptionResponse = {
  success: boolean;
  message?: string;
  data?: PurchaseSubscriptionPaymentData | null;
};

/** Prefer `layer_token` (web/Open Money) then `payment_token`. */
export function resolveLayerPaymentToken(
  data?: PurchaseSubscriptionPaymentData | null,
): string | null {
  if (data == null) {
    return null;
  }
  const layer = data.layer_token?.trim();
  if (layer) {
    return layer;
  }
  return data.payment_token?.trim() ?? null;
}
