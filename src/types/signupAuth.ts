export type SignupType = 'email' | 'phone';

export type SignupPlatform = 'android' | 'ios';

export type RequestOtpEmailBody = {
  signup_type: 'email';
  email: string;
};

export type RequestOtpPhoneBody = {
  signup_type: 'phone';
  phone: string;
};

export type RequestSignupOtpBody = RequestOtpEmailBody | RequestOtpPhoneBody;

type VerifySignupOtpBase = {
  otp: string;
  password: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  platform: SignupPlatform;
};

export type VerifySignupOtpEmailBody = VerifySignupOtpBase & {
  signup_type: 'email';
  email: string;
};

export type VerifySignupOtpPhoneBody = VerifySignupOtpBase & {
  signup_type: 'phone';
  phone: string;
};

export type VerifySignupOtpBody = VerifySignupOtpEmailBody | VerifySignupOtpPhoneBody;

export type SignupVerifyUser = {
  id: number;
  email: string;
  phone: string | null;
  name: string | null;
  auth_provider: string;
  is_system_admin: boolean;
};

export type SignupVerifyData = {
  token: string;
  user: SignupVerifyUser;
};

export type ApiSuccess<T = unknown> = {
  success: true;
  message: string;
  data?: T;
};

export type ApiErrorBody = {
  success: false;
  message: string;
};
