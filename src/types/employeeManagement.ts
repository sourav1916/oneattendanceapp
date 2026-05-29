import type {
  EmployeeListAttendanceMethod,
  EmployeeListItem,
  EmployeeListMeta,
  EmployeeListPermission,
  EmployeeListWeekend,
} from '@src/types/employeeList';

export type { EmployeeListItem, EmployeeListMeta };

export type ConstantOption = {
  value: string;
  label: string;
};

export type AttendanceMethodConstant = {
  id: string;
  name: string;
  available: boolean;
  requiresDevice: boolean;
};

export type CompanyConstants = {
  designations: ConstantOption[];
  employment_types: ConstantOption[];
  salary_types: ConstantOption[];
  employment_statuses: ConstantOption[];
  attendance_methods: AttendanceMethodConstant[];
};

export type ConstantsResponse = {
  success: boolean;
  message: string;
  data: CompanyConstants | null;
};

export type PermissionPackagePermission = {
  id: number;
  code: string;
  name: string;
  action: string;
};

export type PermissionPackage = {
  id: number;
  name: string;
  description: string | null;
  group_code: string | null;
  permissions: PermissionPackagePermission[];
};

export type PermissionPackagesResponse = {
  success: boolean;
  message: string;
  data: PermissionPackage[] | null;
};

export type EmployeeUpdatePayload = {
  employee_id: number;
  designation?: string;
  employment_type?: string;
  salary_type?: string;
  permission_package_id?: number;
  attendance_methods?: string[];
  auto_approve?: boolean;
  shift_start?: string;
  shift_end?: string;
  break_minutes?: number;
  grace_minutes?: number;
  weekends?: string[];
};

export type EmployeeUpdateResponse = {
  success: boolean;
  message: string;
};

export type EmployeeDeletePayload = {
  employee_id: number;
};

export type EmployeeDeleteResponse = {
  success: boolean;
  message: string;
};

export type EmployeeEditFormData = {
  designation: string;
  employment_type: string;
  salary_type: string;
  permission_package_id: number | null;
  attendance_methods: string[];
  auto_approve: boolean;
  shift_start: string;
  shift_end: string;
  break_minutes: string;
  grace_minutes: string;
  weekends: string[];
};

export type ModalType = 'NONE' | 'VIEW' | 'EDIT' | 'DELETE_CONFIRM';

export type {
  EmployeeListAttendanceMethod,
  EmployeeListPermission,
  EmployeeListWeekend,
};
