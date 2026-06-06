import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchEmployeeShifts } from '@src/api/shiftApi';
import type { EmployeeShiftRow, EmployeeShiftsMeta } from '@src/types/employeeShifts';
import { readApiError } from '@src/utils/readApiError';

const DEFAULT_LIMIT = 20;

export type UseEmployeeShiftsOptions = {
  companyId: number | null;
  month: number;
  year: number;
  page: number;
  limit?: number;
  search?: string;
};

export type UseEmployeeShiftsResult = {
  employees: EmployeeShiftRow[];
  meta: EmployeeShiftsMeta | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  accessDenied: boolean;
  refresh: () => void;
  retry: () => void;
};

export function useEmployeeShifts({
  companyId,
  month,
  year,
  page,
  limit = DEFAULT_LIMIT,
  search = '',
}: UseEmployeeShiftsOptions): UseEmployeeShiftsResult {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<EmployeeShiftRow[]>([]);
  const [meta, setMeta] = useState<EmployeeShiftsMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchIdRef = useRef(0);

  const load = useCallback(
    async (isRefresh = false) => {
      if (companyId == null) {
        setEmployees([]);
        setMeta(null);
        setError(null);
        setAccessDenied(false);
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
        const res = await fetchEmployeeShifts(companyId, {
          month,
          year,
          page,
          limit,
          search: search.trim() || undefined,
        });

        if (fetchId !== fetchIdRef.current) {
          return;
        }

        if (res.success) {
          setEmployees(res.data ?? []);
          setMeta(res.meta ?? null);
        } else {
          setEmployees([]);
          setMeta(null);
          setError(res.message?.trim() || t('home.shiftManagement.apiError'));
        }
      } catch (e) {
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        if (axios.isAxiosError(e) && e.response?.status === 403) {
          setAccessDenied(true);
          setError(t('home.shiftManagement.accessDenied'));
        } else {
          setError(readApiError(e));
        }
        setEmployees([]);
        setMeta(null);
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [companyId, limit, month, page, search, t, year],
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
    employees,
    meta,
    loading,
    refreshing,
    error,
    accessDenied,
    refresh,
    retry,
  };
}
