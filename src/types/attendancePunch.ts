export type ApiAttendanceMethod = 'gps' | 'ip' | 'manual';

export type AttendanceMode = 'auto' | 'manual';

export type AttendancePunchPayload = {
  attendance_method: ApiAttendanceMethod;
  attendance_mode: AttendanceMode;
  latitude?: number;
  longitude?: number;
};

export type PunchActionResponse<T = unknown> = {
  success: boolean;
  message: string;
  data?: T;
};
