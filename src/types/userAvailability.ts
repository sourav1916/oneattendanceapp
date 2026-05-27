export type AvailableUser = {
  id: number;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  created_at: string;
};

export type UserAvailabilityCode =
  | 'USER_AVAILABLE'
  | 'IDENTIFIER_REQUIRED'
  | 'EMAIL_AND_MOBILE_NOT_ALLOWED'
  | 'INVALID_EMAIL'
  | 'INVALID_MOBILE'
  | 'USER_NOT_FOUND'
  | 'USER_ALREADY_EMPLOYEE'
  | 'INVITE_ALREADY_PENDING'
  | 'INTERNAL_SERVER_ERROR'
  | string;

export type UserAvailabilityResponse = {
  success: boolean;
  code?: UserAvailabilityCode;
  message: string;
  data: AvailableUser | null;
};
