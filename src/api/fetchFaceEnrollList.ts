import { authHttpClient } from '@src/api/authHttpClient';
import type { FaceEnrollListResponse } from '@src/types/faceEnrollList';

export type FetchFaceEnrollListParams = {
  search?: string;
  page?: number;
  limit?: number;
};

const DEFAULT_LIMIT = 20;

/** GET `/employees/face-enroll/list` — Bearer + `company` header. */
export async function fetchFaceEnrollList(
  companyId: number,
  params: FetchFaceEnrollListParams = {},
): Promise<FaceEnrollListResponse> {
  const page = params.page ?? 1;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const search = params.search?.trim() ?? '';

  const { data } = await authHttpClient.get<FaceEnrollListResponse>(
    '/employees/face-enroll/list',
    {
      headers: {
        company: String(companyId),
      },
      params: {
        page,
        limit,
        search,
      },
    },
  );

  if (data.meta) {
    data.meta.is_last_page = data.meta.page >= data.meta.total_pages;
  }

  return data;
}
