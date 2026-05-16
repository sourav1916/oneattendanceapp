import { authHttpClient } from '@src/api/authHttpClient';
import type { LeaveBalanceResponse } from '@src/types/leaveBalance';

/** GET `/leave/my-balance` — requires `company` header (company id). */
export async function fetchMyLeaveBalance(companyId: number): Promise<LeaveBalanceResponse> {
  const { data } = await authHttpClient.get<LeaveBalanceResponse>('/leave/my-balance', {
    headers: {
      company: String(companyId),
    },
  });
  return data;
}
