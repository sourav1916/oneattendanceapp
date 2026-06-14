import type { LoginType } from '@src/types/loginAuth';

export type VerifyOtpRouteParams = {
  loginType: LoginType;
  /** Formatted email or phone (`+91 9876543210`) sent to the API. */
  identifier: string;
  password: string;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  VerifyEmailOtp: VerifyOtpRouteParams;
};

/** Stack inside the Settings tab (list + sub-screens). */
export type SettingsStackParamList = {
  SettingsHome: undefined;
  Profile: undefined;
  EditProfile: undefined;
  Sessions: undefined;
  ChangePassword: undefined;
  MyCalendar: undefined;
  Support: undefined;
  Subscription: undefined;
  About: undefined;
};

/** Stack inside the Home tab (dashboard + leave balance, etc.). */
export type HomeStackParamList = {
  HomeMain: undefined;
  LeaveRequest: undefined;
  MyCalendar: undefined;
  CompanyList: undefined;
  AttendanceManagement: undefined;
  EmployeeManagement: undefined;
  LeaveManagement: undefined;
  LeaveRequests: undefined;
  LeaveBalance: undefined;
  LeaveConfig: undefined;
  EmployeeList: undefined;
  FaceEnroll: undefined;
  FaceAttendance: undefined;
  InvitePackages: undefined;
  CompanyInvites: undefined;
  PermissionManagement: undefined;
  EmployeeProfile: { employeeId: number };
  OnboardingRequest: undefined;
  CompanyLedger: undefined;
  Reports: undefined;
  Ledger: undefined;
  MySalary: undefined;
  BankAccounts: undefined;
  PayrollManagement: undefined;
  ShiftManagement: undefined;
  CreateEmployee: undefined;
};

/** Face attendance flow (Face Attendance tab stack). */
export type FaceAttendanceFlowParamList = {
  FaceAttendanceMain: undefined;
  FaceEnroll: undefined;
};

/** Main app shell: bottom tabs after login. */
export type MainTabParamList = {
  Home: undefined;
  Attendance: undefined;
  AttendanceManagement: undefined;
  FaceAttendance: undefined;
  Settings: undefined;
};
