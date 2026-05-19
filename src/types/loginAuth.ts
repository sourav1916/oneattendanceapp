export type LoginType = 'phone' | 'email';

export type RequestLoginOtpBody = {
  login_type: LoginType;
  password: string;
  email?: string;
  phone?: string;
};

export type VerifyLoginOtpBody = {
  login_type: LoginType;
  password: string;
  otp: string;
  platform: 'android' | 'ios' | 'web';
  latitude: number;
  longitude: number;
  email?: string;
  phone?: string;
};
