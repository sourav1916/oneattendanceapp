import { NativeModules, Platform } from 'react-native';

import {
  ZWITCH_OPEN_ACCESS_KEY,
  ZWITCH_PAYMENT_ENVIRONMENT,
} from '@src/utils/config';

export type ZwitchPaymentEnvironment = 'sandbox' | 'live';

export type ZwitchTransactionResult = {
  paymentId: string;
  paymentTokenId: string;
  status: string;
};

type ZwitchPaymentNativeModule = {
  startPayment(
    paymentToken: string,
    accessKey: string,
    environment: ZwitchPaymentEnvironment,
    colorPrimary: string | null,
  ): Promise<ZwitchTransactionResult>;
};

const NativeZwitchPayment = NativeModules.ZwitchPayment as
  | ZwitchPaymentNativeModule
  | undefined;

/** Match web Layer.checkout theme.color */
const PAYMENT_THEME_COLOR = '#3d9080';

export class ZwitchPaymentNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZwitchPaymentNotAvailableError';
  }
}

export class ZwitchPaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZwitchPaymentConfigError';
  }
}

export function isZwitchPaymentSuccess(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return (
    normalized === 'captured' ||
    normalized === 'success' ||
    normalized === 'successful' ||
    normalized === 'succeeded'
  );
}

export function isZwitchPaymentCancelled(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === 'cancelled' || normalized === 'canceled';
}

/** Gateway integration error (Layer.js second callback / SDK `onError`). */
export function isZwitchAccessNotAllowedError(message: string): boolean {
  return message.toLowerCase().includes('access not allowed');
}

export function readZwitchPaymentError(err: unknown): string {
  if (
    err instanceof ZwitchPaymentConfigError ||
    err instanceof ZwitchPaymentNotAvailableError
  ) {
    return err.message;
  }
  if (err && typeof err === 'object') {
    const native = err as { message?: unknown; userInfo?: { message?: unknown } };
    const userMsg = native.userInfo?.message;
    if (typeof userMsg === 'string' && userMsg.trim()) {
      return userMsg.trim();
    }
    if (typeof native.message === 'string' && native.message.trim()) {
      return native.message.trim();
    }
  }
  return err instanceof Error ? err.message : 'Payment could not be started.';
}

export async function startZwitchSubscriptionPayment(
  paymentToken: string,
): Promise<ZwitchTransactionResult> {
  if (Platform.OS !== 'android') {
    throw new ZwitchPaymentNotAvailableError(
      'Zwitch payment is only available on Android.',
    );
  }

  const accessKey = ZWITCH_OPEN_ACCESS_KEY.trim();
  if (!accessKey) {
    throw new ZwitchPaymentConfigError(
      'ZWITCH_OPEN_ACCESS_KEY is not set in src/utils/config.ts.',
    );
  }

  if (NativeZwitchPayment?.startPayment == null) {
    throw new ZwitchPaymentNotAvailableError(
      'Zwitch payment native module is not linked. Rebuild the Android app.',
    );
  }

  const token = paymentToken.trim();
  if (!token) {
    throw new ZwitchPaymentConfigError('Payment token is missing.');
  }

  return NativeZwitchPayment.startPayment(
    token,
    accessKey,
    ZWITCH_PAYMENT_ENVIRONMENT,
    PAYMENT_THEME_COLOR,
  );
}
