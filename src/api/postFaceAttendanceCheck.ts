import { authHttpClient } from '@src/api/authHttpClient';
import type {
  FaceAttendanceCheckPayload,
  FaceAttendanceCheckResponse,
} from '@src/types/faceAttendance';

const FACE_ATTENDANCE_CHECK_TIMEOUT_MS = 120_000;

/** POST `/attendance/face-attendance-check` — identify + validate action (manager). */
export async function postFaceAttendanceCheck(
  companyId: number,
  payload: FaceAttendanceCheckPayload,
): Promise<FaceAttendanceCheckResponse> {
  const { data } = await authHttpClient.post<FaceAttendanceCheckResponse>(
    '/attendance/face-attendance-check',
    payload,
    {
      headers: {
        company: String(companyId),
      },
      timeout: FACE_ATTENDANCE_CHECK_TIMEOUT_MS,
    },
  );
  return data;
}
