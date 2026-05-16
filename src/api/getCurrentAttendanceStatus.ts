import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { authHttpClient } from '@src/api/authHttpClient';
import {
  normalizeCurrentAttendanceStatusData,
  type CurrentAttendanceStatusData,
  type CurrentAttendanceStatusResponse,
} from '@src/types/currentAttendanceStatus';
import { resolveAttendanceStatusFetchError } from '@src/utils/attendanceStatusUi';

/**
 * GET `/current-status` — uses Bearer token from `authHttpClient` and `company` header (company id).
 *
 * For loading / error / refresh state around this call, use {@link useCurrentAttendanceStatus}.
 */
export async function getCurrentAttendanceStatus(
  companyId: number,
): Promise<CurrentAttendanceStatusResponse> {
  const { data } = await authHttpClient.get<CurrentAttendanceStatusResponse>('/attendance/current-status', {
    headers: {
      company: String(companyId),
    },
  });

  console.log(data);

  if (data?.success && data.data != null && typeof data.data === 'object') {
    return {
      ...data,
      data: normalizeCurrentAttendanceStatusData(
        data.data as Partial<CurrentAttendanceStatusData>,
      ),
    };
  }
  return data;
}

/**
 * Owns `statusData`, `loading`, `refreshing`, and `errorMessage` for `/current-status`.
 */
export function useCurrentAttendanceStatus(companyId: number | null) {
  const { t } = useTranslation();
  const [statusData, setStatusData] = useState<CurrentAttendanceStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'full' | 'refresh') => {
      if (companyId == null) {
        setStatusData(null);
        setErrorMessage(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setErrorMessage(null);
      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const res = await getCurrentAttendanceStatus(companyId);
        if (res == null || typeof res !== 'object') {
          setStatusData(null);
          setErrorMessage(t('attendance.errors.unexpected'));
          return;
        }
        if (!res.success || res.data == null) {
          setStatusData(null);
          setErrorMessage(res.message?.trim() || t('attendance.errors.fetchFailed'));
          return;
        }
        setStatusData(res.data);
      } catch (e) {
        setStatusData(null);
        setErrorMessage(resolveAttendanceStatusFetchError(e, t));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId, t],
  );

  return {
    statusData,
    loading,
    refreshing,
    errorMessage,
    load,
    setErrorMessage,
  };
}
