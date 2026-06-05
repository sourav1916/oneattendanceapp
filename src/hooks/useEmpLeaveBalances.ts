import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { leaveApi } from '@src/api/leaveApi';
import type {
  EmpLeaveBalanceEmployee,
  EmpLeaveBalanceMeta,
  EmpLeaveBalanceType,
} from '@src/types/empLeaveBalance';
import { coerceLeaveDays } from '@src/utils/formatLeaveDays';
import { readApiError } from '@src/utils/readApiError';

function normalizeLeaveBalanceType(
  raw: EmpLeaveBalanceType & { code?: string },
): EmpLeaveBalanceType {
  return {
    ...raw,
    type: raw.type?.trim() || raw.code?.trim() || '',
    total_allocated: coerceLeaveDays(raw.total_allocated),
    used: coerceLeaveDays(raw.used),
    remaining: coerceLeaveDays(raw.remaining),
    max_balance: raw.max_balance == null ? null : coerceLeaveDays(raw.max_balance),
    carry_forward_limit: coerceLeaveDays(raw.carry_forward_limit),
  };
}

function normalizeEmployeeBalance(
  employee: EmpLeaveBalanceEmployee,
): EmpLeaveBalanceEmployee {
  return {
    ...employee,
    leaves: (employee.leaves ?? []).map(normalizeLeaveBalanceType),
  };
}

const DEFAULT_LIMIT = 20;

export type UseEmpLeaveBalancesOptions = {
  companyId: number | null;
  year: number;
  page: number;
  limit?: number;
  search?: string;
};

export type UseEmpLeaveBalancesResult = {
  employees: EmpLeaveBalanceEmployee[];
  meta: EmpLeaveBalanceMeta | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  accessDenied: boolean;
  refresh: () => void;
  retry: () => void;
};

export function useEmpLeaveBalances({
  companyId,
  year,
  page,
  limit = DEFAULT_LIMIT,
  search = '',
}: UseEmpLeaveBalancesOptions): UseEmpLeaveBalancesResult {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<EmpLeaveBalanceEmployee[]>([]);
  const [meta, setMeta] = useState<EmpLeaveBalanceMeta | null>(null);
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
        const res = await leaveApi.getEmpBalances(companyId, {
          year,
          page,
          limit,
          search: search.trim() || undefined,
        });

        if (fetchId !== fetchIdRef.current) {
          return;
        }

        if (res.success) {
          setEmployees((res.data ?? []).map(normalizeEmployeeBalance));
          setMeta(res.meta ?? null);
        } else {
          setEmployees([]);
          setMeta(null);
          setError(res.message?.trim() || t('home.leaveBalances.apiError'));
        }
      } catch (e) {
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        if (axios.isAxiosError(e) && e.response?.status === 403) {
          setAccessDenied(true);
          setError(t('home.leaveBalances.accessDenied'));
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
    [companyId, limit, page, search, t, year],
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
