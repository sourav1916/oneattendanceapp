import axios from 'axios';

import { readApiError } from '@src/utils/readApiError';

export type PurchaseProfileField = 'name' | 'phone' | 'email';

export type ParsedPurchaseSubscriptionError = {
  message: string;
  statusCode: number | null;
  isOwnerForbidden: boolean;
  profileField: PurchaseProfileField | null;
};

function messageFromResponseBody(body: unknown): string | null {
  if (body == null || typeof body !== 'object') {
    return null;
  }
  const msg = (body as { message?: unknown }).message;
  return typeof msg === 'string' && msg.trim() ? msg.trim() : null;
}

function detectProfileField(message: string): PurchaseProfileField | null {
  const lower = message.toLowerCase();
  if (lower.includes('name is required')) {
    return 'name';
  }
  if (lower.includes('phone is required')) {
    return 'phone';
  }
  if (lower.includes('email is required')) {
    return 'email';
  }
  return null;
}

export function parsePurchaseSubscriptionMessage(
  message: string,
  statusCode: number | null = null,
): ParsedPurchaseSubscriptionError {
  const trimmed = message.trim();
  return {
    message: trimmed,
    statusCode,
    isOwnerForbidden: statusCode === 403,
    profileField: detectProfileField(trimmed),
  };
}

export function parsePurchaseSubscriptionError(
  err: unknown,
): ParsedPurchaseSubscriptionError {
  if (axios.isAxiosError(err)) {
    const statusCode = err.response?.status ?? null;
    const bodyMessage = messageFromResponseBody(err.response?.data);
    const message = bodyMessage ?? readApiError(err);
    return {
      message,
      statusCode,
      isOwnerForbidden: statusCode === 403,
      profileField: detectProfileField(message),
    };
  }

  const message = readApiError(err);
  return {
    message,
    statusCode: null,
    isOwnerForbidden: false,
    profileField: detectProfileField(message),
  };
}
