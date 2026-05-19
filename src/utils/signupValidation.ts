import { Platform } from 'react-native';

import { isValidEmail, isValidNationalMobile } from '@src/utils/loginIdentifier';
import { validatePasswordWithConfirm } from '@src/utils/passwordPolicy';
import type { SignupType } from '@src/types/signupAuth';

export const SIGNUP_DEV_OTP_HINT = '123456';

export function getSignupPlatform(): 'android' | 'ios' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

export function normalizeSignupPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function validateSignupRequestStep(params: {
  signupType: SignupType;
  email: string;
  phone: string;
}): string | null {
  if (params.signupType === 'email') {
    const email = params.email.trim();
    if (!email) {
      return 'Email is required.';
    }
    if (!isValidEmail(email)) {
      return 'Please enter a valid email address.';
    }
    return null;
  }

  const phone = normalizeSignupPhoneDigits(params.phone);
  if (!isValidNationalMobile(phone)) {
    return 'Please enter a valid phone number (at least 10 digits).';
  }
  return null;
}

export function validateSignupVerifyStep(params: {
  signupType: SignupType;
  email: string;
  phone: string;
  otp: string;
  name: string;
  password: string;
  confirmPassword: string;
}): string | null {
  const otp = params.otp.replace(/\D/g, '');
  if (otp.length !== 6) {
    return 'Please enter the 6-digit OTP.';
  }

  if (params.signupType === 'email') {
    const email = params.email.trim();
    if (!email) {
      return 'Email is required.';
    }
    if (!isValidEmail(email)) {
      return 'Please enter a valid email address.';
    }
  } else {
    const phone = normalizeSignupPhoneDigits(params.phone);
    if (!isValidNationalMobile(phone)) {
      return 'Phone number is required.';
    }
  }

  const name = params.name.trim();
  if (!name) {
    return 'Full name is required.';
  }

  const passwordError = validatePasswordWithConfirm(params.password, params.confirmPassword);
  if (passwordError) {
    return passwordError;
  }

  return null;
}

export function readApiSuccessMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }
  return fallback;
}
