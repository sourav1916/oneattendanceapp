import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { leaveApi } from '@src/api/leaveApi';
import type {
  CompanyLeaveConfig,
  CompanyLeaveConfigMeta,
} from '@src/types/leaveConfig';
import { readApiError } from '@src/utils/readApiError';

const DEFAULT_LIMIT = 20;

export type UseLeaveConfigsOptions = {
  companyId: number | null;
  page: number;
  limit?: number;
  search?: string;
  isActive?: boolean | null;
  isPaid?: boolean | null;
};

export type UseLeaveConfigsResult = {
  configs: CompanyLeaveConfig[];
  meta: CompanyLeaveConfigMeta | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  accessDenied: boolean;
  refresh: () => void;
  retry: () => void;
};

export function useLeaveConfigs({
  companyId,
  page,
  limit = DEFAULT_LIMIT,
  search = '',
  isActive = null,
  isPaid = null,
}: UseLeaveConfigsOptions): UseLeaveConfigsResult {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<CompanyLeaveConfig[]>([]);
  const [meta, setMeta] = useState<CompanyLeaveConfigMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchIdRef = useRef(0);

  const load = useCallback(
    async (isRefresh = false) => {
      if (companyId == null) {
        setConfigs([]);
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
        const res = await leaveApi.getCompanyLeaveConfigs(companyId, {
          page,
          limit,
          search: search.trim() || undefined,
          is_active: isActive ?? undefined,
          is_paid: isPaid ?? undefined,
        });

        if (fetchId !== fetchIdRef.current) {
          return;
        }

        if (res.success) {
          setConfigs(res.data ?? []);
          setMeta(res.meta ?? null);
        } else {
          setConfigs([]);
          setMeta(null);
          setError(res.message?.trim() || t('home.leaveConfig.apiError'));
        }
      } catch (e) {
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        if (axios.isAxiosError(e) && e.response?.status === 403) {
          setAccessDenied(true);
          setError(t('home.leaveConfig.accessDenied'));
        } else {
          setError(readApiError(e));
        }
        setConfigs([]);
        setMeta(null);
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [companyId, isActive, isPaid, limit, page, search, t],
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
    configs,
    meta,
    loading,
    refreshing,
    error,
    accessDenied,
    refresh,
    retry,
  };
}
