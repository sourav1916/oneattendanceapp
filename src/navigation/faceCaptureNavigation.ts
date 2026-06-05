import type { FaceAttendanceActionType } from '@src/types/faceAttendance';
import type { FaceAttendanceMatchedEmployee } from '@src/utils/parseFaceAttendanceCheck';

export type PendingStatusAlert = {
  tone: 'error' | 'warning' | 'success';
  title: string;
  message?: string;
};

export type FaceAttendancePendingDenied = {
  employee: FaceAttendanceMatchedEmployee;
  message: string;
  action: FaceAttendanceActionType;
};
