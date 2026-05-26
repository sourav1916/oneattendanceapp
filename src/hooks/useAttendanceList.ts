import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { attendanceApi } from '@src/api/attendanceApi';
import type {
  AttendanceDayStatus,
  AttendanceListCounts,
  AttendanceListMeta,
  EmployeeAttendanceRow,
} from '@src/types/attendanceList';
import { readApiError } from '@src/utils/readApiError';

const DEFAULT_LIMIT = 20;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  return ISO_DATE_RE.test(value.trim());
}

export type UseAttendanceListOptions = {
  companyId: number | null;
  fromDate: string;
  toDate: string;
  dayStatus?: AttendanceDayStatus | null;
  search?: string;
  limit?: number;
  /** Called when API returns success: false or on network errors (for toast). */
  onError?: (message: string) => void;
};

export type UseAttendanceListResult = {
  employees: EmployeeAttendanceRow[];
  meta: AttendanceListMeta | null;
  counts: AttendanceListCounts | null;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
  loadMore: () => void;
  retry: () => void;
};

export function useAttendanceList({
  companyId,
  fromDate,
  toDate,
  dayStatus = null,
  search = '',
  limit = DEFAULT_LIMIT,
  onError,
}: UseAttendanceListOptions): UseAttendanceListResult {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<EmployeeAttendanceRow[]>([]);
  const [meta, setMeta] = useState<AttendanceListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFirstIdRef = useRef(0);
  const loadedPageRef = useRef(0);
  const endReachedLock = useRef(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const notifyError = useCallback((message: string) => {
    onErrorRef.current?.(message);
  }, []);

  const loadFirst = useCallback(async () => {
    if (companyId == null) {
      setEmployees([]);
      setMeta(null);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!isValidIsoDate(fromDate) || !isValidIsoDate(toDate)) {
      const msg = t('home.attendanceManagement.invalidDate');
      setEmployees([]);
      setMeta(null);
      setError(msg);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const fetchId = ++fetchFirstIdRef.current;
    loadedPageRef.current = 0;
    setLoading(true);
    setError(null);
    endReachedLock.current = false;

    try {
      const res = await attendanceApi.getAttendanceList(companyId, {
        from_date: fromDate,
        to_date: toDate,
        day_status: dayStatus ?? undefined,
        search,
        page: 1,
        limit,
      });

      if (fetchId !== fetchFirstIdRef.current) {
        return;
      }

      if (!res.success) {
        const msg = res.message?.trim() || t('home.attendanceManagement.apiError');
        setError(msg);
        notifyError(msg);
        setEmployees([]);
        setMeta(null);
        return;
      }

      setEmployees(res.data ?? []);
      setMeta(res.meta);
      loadedPageRef.current = 1;
    } catch (e) {
      if (fetchId !== fetchFirstIdRef.current) {
        return;
      }
      const msg = readApiError(e);
      setError(msg);
      notifyError(msg);
      setEmployees([]);
      setMeta(null);
    } finally {
      if (fetchId === fetchFirstIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [companyId, dayStatus, fromDate, limit, notifyError, search, t, toDate]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (companyId == null || meta == null || loadingMore || loading) {
      return;
    }
    if (meta.is_last_page) {
      return;
    }
    if (meta.total_pages > 0 && loadedPageRef.current >= meta.total_pages) {
      return;
    }

    setLoadingMore(true);
    try {
      const nextPage = loadedPageRef.current + 1;
      const res = await attendanceApi.getAttendanceList(companyId, {
        from_date: fromDate,
        to_date: toDate,
        day_status: dayStatus ?? undefined,
        search,
        page: nextPage,
        limit,
      });

      if (!res.success) {
        const msg = res.message?.trim() || t('home.attendanceManagement.apiError');
        notifyError(msg);
        return;
      }

      const chunk = res.data ?? [];
      if (chunk.length === 0) {
        setMeta(m => (m ? { ...m, is_last_page: true } : m));
        return;
      }

      loadedPageRef.current = nextPage;
      setEmployees(prev => [...prev, ...chunk]);
      setMeta(res.meta);
    } catch (e) {
      notifyError(readApiError(e));
    } finally {
      setLoadingMore(false);
      endReachedLock.current = false;
    }
  }, [
    companyId,
    dayStatus,
    fromDate,
    limit,
    loading,
    loadingMore,
    meta,
    notifyError,
    search,
    t,
    toDate,
  ]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void loadFirst();
  }, [loadFirst]);

  const retry = useCallback(() => {
    void loadFirst();
  }, [loadFirst]);

  const tryLoadMore = useCallback(() => {
    if (endReachedLock.current || loading || loadingMore || meta == null) {
      return;
    }
    if (meta.is_last_page) {
      return;
    }
    if (meta.total_pages > 0 && loadedPageRef.current >= meta.total_pages) {
      return;
    }
    endReachedLock.current = true;
    void loadMore();
  }, [loadMore, loading, loadingMore, meta]);

  return {
    employees,
    meta,
    counts: meta?.counts ?? null,
    loading,
    loadingMore,
    refreshing,
    error,
    refresh,
    loadMore: tryLoadMore,
    retry,
  };
}
