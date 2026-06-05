import type {
  SubscriptionPackage,
  SubscriptionPeriod,
} from '@src/types/subscriptionPackage';

export type BillingOption = {
  key: SubscriptionPeriod;
  price: number;
  labelKey:
    | 'settings.subscriptionScreen.periods.monthly'
    | 'settings.subscriptionScreen.periods.quarterly'
    | 'settings.subscriptionScreen.periods.halfYearly'
    | 'settings.subscriptionScreen.periods.yearly';
};

export type BillingOptionWithDiscount = BillingOption & {
  /** Rounded % saved vs paying monthly for the same span; null if none. */
  discountPercent: number | null;
};

export type BillingPeriodSlot = {
  key: SubscriptionPeriod;
  labelKey: BillingOption['labelKey'];
  available: boolean;
  price: number | null;
  discountPercent: number | null;
};

export const ALL_SUBSCRIPTION_PERIODS: SubscriptionPeriod[] = [
  'monthly',
  'quarterly',
  'half_yearly',
  'yearly',
];

const PERIOD_MONTHS: Record<SubscriptionPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

const PERIOD_CONFIG: {
  key: SubscriptionPeriod;
  priceKey: keyof SubscriptionPackage;
  labelKey: BillingOption['labelKey'];
}[] = [
  {
    key: 'monthly',
    priceKey: 'monthly_price',
    labelKey: 'settings.subscriptionScreen.periods.monthly',
  },
  {
    key: 'quarterly',
    priceKey: 'quarterly_price',
    labelKey: 'settings.subscriptionScreen.periods.quarterly',
  },
  {
    key: 'half_yearly',
    priceKey: 'half_yearly_price',
    labelKey: 'settings.subscriptionScreen.periods.halfYearly',
  },
  {
    key: 'yearly',
    priceKey: 'yearly_price',
    labelKey: 'settings.subscriptionScreen.periods.yearly',
  },
];

export function getBillingOptions(pkg: SubscriptionPackage): BillingOption[] {
  const options: BillingOption[] = [];
  for (const period of PERIOD_CONFIG) {
    const raw = pkg[period.priceKey];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      options.push({
        key: period.key,
        price: raw,
        labelKey: period.labelKey,
      });
    }
  }
  return options;
}

export function getPeriodDiscountPercent(
  pkg: SubscriptionPackage,
  period: SubscriptionPeriod,
  periodPrice: number,
): number | null {
  if (period === 'monthly') {
    return null;
  }
  const monthly = pkg.monthly_price;
  if (monthly == null || monthly <= 0 || periodPrice <= 0) {
    return null;
  }
  const months = PERIOD_MONTHS[period];
  const fullPrice = monthly * months;
  if (fullPrice <= periodPrice) {
    return null;
  }
  const pct = Math.round(((fullPrice - periodPrice) / fullPrice) * 100);
  return pct >= 1 ? pct : null;
}

export function getBillingOptionsWithDiscount(
  pkg: SubscriptionPackage,
): BillingOptionWithDiscount[] {
  return getBillingOptions(pkg).map(option => ({
    ...option,
    discountPercent: getPeriodDiscountPercent(pkg, option.key, option.price),
  }));
}

/** Every billing period for UI — unavailable slots have `available: false`. */
export function getAllBillingPeriodSlots(
  pkg: SubscriptionPackage,
): BillingPeriodSlot[] {
  return PERIOD_CONFIG.map(period => {
    const raw = pkg[period.priceKey];
    const available = typeof raw === 'number' && Number.isFinite(raw);
    const price = available ? raw : null;
    return {
      key: period.key,
      labelKey: period.labelKey,
      available,
      price,
      discountPercent:
        available && price != null
          ? getPeriodDiscountPercent(pkg, period.key, price)
          : null,
    };
  });
}

export function hasAvailableBillingPeriod(pkg: SubscriptionPackage): boolean {
  return getAllBillingPeriodSlots(pkg).some(slot => slot.available);
}

export function getPackagePrice(
  pkg: SubscriptionPackage,
  period: SubscriptionPeriod,
): number | null {
  const match = getBillingOptions(pkg).find(o => o.key === period);
  return match?.price ?? null;
}

export function formatSubscriptionPrice(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function defaultPeriodForPackage(
  pkg: SubscriptionPackage,
): SubscriptionPeriod | null {
  return getBillingOptions(pkg)[0]?.key ?? null;
}

export function packageAtIndex(
  packages: SubscriptionPackage[],
  index: number,
): SubscriptionPackage | null {
  if (index < 0 || index >= packages.length) {
    return null;
  }
  return packages[index] ?? null;
}

export function sliderIndexFromRatio(ratio: number, stepCount: number): number {
  if (stepCount <= 1) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(1, ratio));
  return Math.round(clamped * (stepCount - 1));
}

export function sliderThumbRatio(index: number, stepCount: number): number {
  if (stepCount <= 1) {
    return 0;
  }
  return index / (stepCount - 1);
}
