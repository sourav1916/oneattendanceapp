import axios from 'axios';

import type {
  FaceAttendanceCheckEmployeeFields,
  FaceAttendanceCheckResponse,
} from '@src/types/faceAttendance';

export type FaceAttendanceMatchedEmployee = {
  employeeId: number;
  employeeName: string;
  profilePictureUrl?: string;
  designation?: string;
  email?: string;
  mobile?: string;
  similarity?: number;
};

export type ParsedFaceAttendanceCheck =
  | { kind: 'allowed'; employee: FaceAttendanceMatchedEmployee }
  | {
      kind: 'not_allowed';
      employee: FaceAttendanceMatchedEmployee;
      message: string;
    }
  | { kind: 'failed'; message: string };

function mapEmployeeFields(
  fields: FaceAttendanceCheckEmployeeFields | undefined,
): FaceAttendanceMatchedEmployee | null {
  if (fields == null || typeof fields.employee_id !== 'number') {
    return null;
  }
  const similarity =
    typeof fields.similarity === 'number' && Number.isFinite(fields.similarity)
      ? fields.similarity
      : undefined;
  return {
    employeeId: fields.employee_id,
    employeeName:
      fields.employee_name?.trim() || String(fields.employee_id),
    profilePictureUrl: fields.image?.trim() || undefined,
    designation: fields.designation?.trim() || undefined,
    email: fields.email?.trim() || undefined,
    mobile: fields.mobile?.trim() || undefined,
    similarity,
  };
}

export function parseFaceAttendanceCheckResponse(
  res: FaceAttendanceCheckResponse,
): ParsedFaceAttendanceCheck {
  const message = res.message?.trim() || 'Face check failed.';

  if (res.success && res.data?.allowed === true) {
    const employee = mapEmployeeFields(res.data);
    if (employee) {
      return { kind: 'allowed', employee };
    }
  }

  if (res.errors?.allowed === false || (!res.success && res.errors)) {
    const employee = mapEmployeeFields(res.errors);
    if (employee) {
      return { kind: 'not_allowed', employee, message };
    }
  }

  return { kind: 'failed', message };
}

/** Reads check API body from an axios error (400/404 with JSON body). */
export function faceAttendanceCheckFromAxiosError(
  err: unknown,
): FaceAttendanceCheckResponse | null {
  if (!axios.isAxiosError(err) || err.response?.data == null) {
    return null;
  }
  const body = err.response.data;
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  return body as FaceAttendanceCheckResponse;
}
