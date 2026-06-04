export type CreateEmployeeSignupType = 'email' | 'phone';

export type RequestCreateEmployeeOtpBody =
  | { signup_type: 'email'; email: string }
  | { signup_type: 'phone'; phone: string };

export type RequestCreateEmployeeOtpResponse = {
  success: boolean;
  message?: string;
};

export type CreateEmployeeBody = {
  signup_type: CreateEmployeeSignupType;
  email?: string;
  phone?: string;
  otp: string;
  name: string;
  platform: 'web' | 'android' | 'ios';
  latitude?: number;
  longitude?: number;
  shift_start: string;
  shift_end: string;
  joining_date?: string;
  permission_package_id?: number;
  designation?: string;
  salary_type?: string;
  employment_type?: string;
  weekends?: string[];
  break_minutes?: number;
  grace_minutes?: number;
};

export type CreateEmployeeResponse = {
  success: boolean;
  message?: string;
};

export type CreateEmployeeFormData = {
  name: string;
  joining_date: string;
  permission_package_id: number | null;
  designation: string;
  employment_type: string;
  salary_type: string;
  shift_start: string;
  shift_end: string;
  break_minutes: string;
  grace_minutes: string;
  weekends: string[];
};

export const EMPTY_CREATE_EMPLOYEE_FORM: CreateEmployeeFormData = {
  name: '',
  joining_date: '',
  permission_package_id: null,
  designation: '',
  employment_type: '',
  salary_type: '',
  shift_start: '09:00',
  shift_end: '18:00',
  break_minutes: '01:00',
  grace_minutes: '00:15',
  weekends: [],
};
