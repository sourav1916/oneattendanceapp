import { authHttpClient } from '@src/api/authHttpClient';
import type {
  CheckFaceEnrollPayload,
  FaceEnrollCheckResponse,
} from '@src/types/faceEnrollCheck';

/** Face match may download the image and run ML on the server (> default 30s). */
const FACE_ENROLL_TIMEOUT_MS = 120_000;

/** POST `/employees/face-enroll/check` — Bearer + `company` header. */
export async function checkEmployeeFaceEnroll(
  companyId: number,
  payload: CheckFaceEnrollPayload,
): Promise<FaceEnrollCheckResponse> {
  const { data } = await authHttpClient.post<FaceEnrollCheckResponse>(
    '/employees/face-enroll/check',
    payload,
    {
      headers: {
        company: String(companyId),
      },
      timeout: FACE_ENROLL_TIMEOUT_MS,
    },
  );
  return data;
}
