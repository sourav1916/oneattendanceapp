import { authHttpClient } from '@src/api/authHttpClient';
import type {
  DeleteFaceEnrollPayload,
  DeleteFaceEnrollResponse,
} from '@src/types/faceEnrollDelete';

/** PUT `/employees/face-enroll/delete` — Bearer + `company` header. */
export async function deleteEmployeeFaceEnroll(
  companyId: number,
  payload: DeleteFaceEnrollPayload,
): Promise<DeleteFaceEnrollResponse> {
  const { data } = await authHttpClient.put<DeleteFaceEnrollResponse>(
    '/employees/face-enroll/delete',
    payload,
    {
      headers: {
        company: String(companyId),
      },
    },
  );
  return data;
}
