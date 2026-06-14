import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

import { salaryApi } from '@src/api/salaryApi';
import type { MySalaryData } from '@src/types/salary';
import { readApiError } from '@src/utils/readApiError';

export type UseMySalaryOptions = {
  companyId: number | null;
  month: number;
  year: number;
  enabled?: boolean;
  onError?: (message: string) => void;
};

export function useMySalary({
  companyId,
  month,
  year,
  enabled = true,
  onError,
}: UseMySalaryOptions) {
  const [data, setData] = useState<MySalaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const fetchIdRef = useRef(0);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const load = useCallback(
    async (isRefresh = false) => {
      if (companyId == null || !enabled) {
        setData(null);
        setError(null);
        setNotFound(false);
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
      setNotFound(false);

      try {
        const res = await salaryApi.getMySalary(companyId, { month, year });
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        if (!res.success || !res.data) {
          const msg = res.message?.trim() || 'Could not load salary.';
          setData(null);
          setError(msg);
          onErrorRef.current?.(msg);
          return;
        }
        setData(res.data);
      } catch (e) {
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          setData(null);
          setNotFound(true);
          setError(null);
          return;
        }
        const msg = readApiError(e);
        setData(null);
        setError(msg);
        onErrorRef.current?.(msg);
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [companyId, enabled, month, year],
  );

  useEffect(() => {
    load(false).catch(() => {});
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
  }, [load]);

  const retry = useCallback(() => {
    load(false).catch(() => {});
  }, [load]);

  return {
    data,
    loading,
    refreshing,
    error,
    notFound,
    refresh,
    retry,
  };
}
