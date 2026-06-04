import { authHttpClient } from '@src/api/authHttpClient';
import type {
  FaceAttendanceMarkPayload,
  FaceAttendanceMarkResponse,
} from '@src/types/faceAttendance';

const FACE_ATTENDANCE_TIMEOUT_MS = 120_000;

/** POST `/attendance/face-attendance` — Bearer + `company` header. */
export async function postFaceAttendance(
  companyId: number,
  payload: FaceAttendanceMarkPayload,
): Promise<FaceAttendanceMarkResponse> {
  const { data } = await authHttpClient.post<FaceAttendanceMarkResponse>(
    '/attendance/face-attendance',
    payload,
    {
      headers: {
        company: String(companyId),
      },
      timeout: FACE_ATTENDANCE_TIMEOUT_MS,
    },
  );
  return data;
}
