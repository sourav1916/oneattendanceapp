export type ConstantValuePayload = {
  value: string;
  label: string;
  description?: string;
};

export type ConstantEntry<T extends ConstantValuePayload = ConstantValuePayload> = {
  key: string;
  value: T;
};

export type AttendanceMethodConstantValue = ConstantValuePayload & {
  requiresDevice?: boolean;
  requiresLocation?: boolean;
  requiresCamera?: boolean;
  is_available?: boolean;
};

export type GlobalConstantsData = {
  employment_types?: ConstantEntry[];
  salary_types?: ConstantEntry[];
  designations?: ConstantEntry[];
  employment_status?: ConstantEntry[];
  punch_types?: ConstantEntry[];
  attendance_methods?: ConstantEntry<AttendanceMethodConstantValue>[];
  attendance_modes?: ConstantEntry[];
  leave_types?: ConstantEntry[];
  invite_statuses?: ConstantEntry[];
  half_day_types?: ConstantEntry[];
  leave_statuses?: ConstantEntry[];
  accrual_types?: ConstantEntry[];
  payroll_statuses?: ConstantEntry[];
  payment_methods?: ConstantEntry[];
  currency_types?: ConstantEntry[];
};

export type GlobalConstantsResponse = {
  success: boolean;
  count?: number;
  message?: string;
  data: GlobalConstantsData | null;
};
