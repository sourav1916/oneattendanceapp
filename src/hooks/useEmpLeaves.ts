import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { leaveApi } from '@src/api/leaveApi';
import type {
  EmpLeaveListMeta,
  EmpLeaveStatus,
  EmployeeLeaveRow,
} from '@src/types/employeeLeave';
import { readApiError } from '@src/utils/readApiError';

const DEFAULT_LIMIT = 20;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  return ISO_DATE_RE.test(value.trim());
}

export type UseEmpLeavesOptions = {
  companyId: number | null;
  page: number;
  limit?: number;
  search?: string;
  status?: EmpLeaveStatus | null;
  startDate?: string;
  endDate?: string;
};

export type UseEmpLeavesResult = {
  leaves: EmployeeLeaveRow[];
  meta: EmpLeaveListMeta | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  accessDenied: boolean;
  refresh: () => void;
  retry: () => void;
};

export function useEmpLeaves({
  companyId,
  page,
  limit = DEFAULT_LIMIT,
  search = '',
  status = null,
  startDate = '',
  endDate = '',
}: UseEmpLeavesOptions): UseEmpLeavesResult {
  const { t } = useTranslation();
  const [leaves, setLeaves] = useState<EmployeeLeaveRow[]>([]);
  const [meta, setMeta] = useState<EmpLeaveListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchIdRef = useRef(0);

  const load = useCallback(
    async (isRefresh = false) => {
      if (companyId == null) {
        setLeaves([]);
        setMeta(null);
        setError(null);
        setAccessDenied(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (startDate && !isValidIsoDate(startDate)) {
        setError(t('home.leaveRequests.invalidDate'));
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (endDate && !isValidIsoDate(endDate)) {
        setError(t('home.leaveRequests.invalidDate'));
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const fetchId = ++fetchIdRef.current;
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setAccessDenied(false);

      try {
        const res = await leaveApi.getEmpLeaves(companyId, {
          page,
          limit,
          search: search.trim() || undefined,
          status: status ?? '',
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        });

        if (fetchId !== fetchIdRef.current) {
          return;
        }

        if (res.success) {
          setLeaves(res.data ?? []);
          setMeta(res.meta ?? null);
        } else {
          const msg = Array.isArray(res.message)
            ? res.message.map(e => e.message).join(', ')
            : (res.message ?? t('home.leaveRequests.apiError'));
          setLeaves([]);
          setMeta(null);
          setError(msg);
        }
      } catch (e) {
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        if (axios.isAxiosError(e) && e.response?.status === 403) {
          setAccessDenied(true);
          setError(t('home.leaveRequests.accessDenied'));
        } else {
          setError(readApiError(e));
        }
        setLeaves([]);
        setMeta(null);
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      companyId,
      page,
      limit,
      search,
      status,
      startDate,
      endDate,
      t,
    ],
  );

  useEffect(() => {
    load(false).catch(() => {});
  }, [load]);

  const refresh = useCallback(() => {
    load(true).catch(() => {});
  }, [load]);

  const retry = useCallback(() => {
    load(false).catch(() => {});
  }, [load]);

  return {
    leaves,
    meta,
    loading,
    refreshing,
    error,
    accessDenied,
    refresh,
    retry,
  };
}
