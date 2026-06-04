export type FaceAttendanceActionType =
  | 'punch in'
  | 'punch out'
  | 'break start'
  | 'break end';

export type FaceAttendanceCheckPayload = {
  type: FaceAttendanceActionType;
  image: string;
};

/** Employee fields returned in `data` (allowed) or `errors` (not allowed). */
export type FaceAttendanceCheckEmployeeFields = {
  employee_id: number;
  employee_name?: string;
  designation?: string | null;
  email?: string | null;
  mobile?: string | null;
  image?: string | null;
  similarity?: number | null;
  threshold?: number | null;
  company_id?: number;
  type?: string;
  allowed?: boolean;
};

export type FaceAttendanceCheckResponse = {
  success: boolean;
  message: string;
  data?: FaceAttendanceCheckEmployeeFields;
  errors?: FaceAttendanceCheckEmployeeFields;
};

export type FaceAttendanceMarkPayload = {
  type: FaceAttendanceActionType;
  image: string;
  employee_id: number;
};

export type FaceAttendanceMarkData = {
  type: string;
  employee_id: number;
  attendance_id: number;
  attendance_date: string;
  time: string;
  day_status?: string;
};

export type FaceAttendanceMarkResponse = {
  success: boolean;
  message: string;
  data?: FaceAttendanceMarkData;
};
