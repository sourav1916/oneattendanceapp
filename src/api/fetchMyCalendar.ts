import { authHttpClient } from '@src/api/authHttpClient';
import type { MyCalendarResponse } from '@src/types/myCalendar';

export type FetchMyCalendarParams = {
  year: number;
  month: number;
  companyId: number;
};

/** GET `/shifts/my-calendar` — Bearer + `company` header; year & month query only. */
export async function fetchMyCalendar({
  year,
  month,
  companyId,
}: FetchMyCalendarParams): Promise<MyCalendarResponse> {
  const { data } = await authHttpClient.get<MyCalendarResponse>('/shifts/my-calendar', {
    params: { year, month },
    headers: {
      company: String(companyId),
    },
  });
  return data;
}
