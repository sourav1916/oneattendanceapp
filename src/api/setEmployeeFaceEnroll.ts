import { authHttpClient } from '@src/api/authHttpClient';
import type {
  SetFaceEnrollPayload,
  SetFaceEnrollResponse,
} from '@src/types/faceEnrollSet';

/** Face enroll may download the image and run ML on the server (> default 30s). */
const FACE_ENROLL_TIMEOUT_MS = 120_000;

/** POST `/employees/face-enroll/set` — Bearer + `company` header. */
export async function setEmployeeFaceEnroll(
  companyId: number,
  payload: SetFaceEnrollPayload,
): Promise<SetFaceEnrollResponse> {
  const { data } = await authHttpClient.post<SetFaceEnrollResponse>(
    '/employees/face-enroll/set',
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
