export type LoginType = 'phone' | 'email';

export type RequestLoginOtpBody = {
  login_type: LoginType;
  email?: string;
  phone?: string;
};

export type VerifyLoginOtpBody = {
  login_type: LoginType;
  otp: string;
  platform: 'android' | 'ios' | 'web';
  latitude: number;
  longitude: number;
  email?: string;
  phone?: string;
};
