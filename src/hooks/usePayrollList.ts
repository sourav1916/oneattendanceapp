import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchPayrollList } from '@src/api/payrollApi';
import type {
  GeneratedPayrollRow,
  PayrollListDisplayRow,
  PayrollListMeta,
  PreviewPayrollRow,
} from '@src/types/payrollList';
import { readApiError } from '@src/utils/readApiError';

const DEFAULT_LIMIT = 20;

export type PayrollStatusFilter = 'all' | 'generated' | 'preview';

export type UsePayrollListOptions = {
  companyId: number | null;
  month: number;
  year: number;
  page: number;
  limit?: number;
  statusFilter?: PayrollStatusFilter;
};

export type UsePayrollListResult = {
  generatedPayrolls: GeneratedPayrollRow[];
  previewPayrolls: PreviewPayrollRow[];
  displayRows: PayrollListDisplayRow[];
  meta: PayrollListMeta | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  accessDenied: boolean;
  refresh: () => void;
  retry: () => void;
};

function toDisplayRows(
  generated: GeneratedPayrollRow[],
  preview: PreviewPayrollRow[],
  filter: PayrollStatusFilter,
): PayrollListDisplayRow[] {
  const generatedRows: PayrollListDisplayRow[] = generated.map(row => ({
    kind: 'generated',
    employee: row.employee,
    payroll: row.payroll,
  }));
  const previewRows: PayrollListDisplayRow[] = preview.map(row => ({
    kind: 'preview',
    employee: row.employee,
    payroll: row.payroll,
  }));

  if (filter === 'generated') {
    return generatedRows;
  }
  if (filter === 'preview') {
    return previewRows;
  }
  return [...generatedRows, ...previewRows];
}

export function usePayrollList({
  companyId,
  month,
  year,
  page,
  limit = DEFAULT_LIMIT,
  statusFilter = 'all',
}: UsePayrollListOptions): UsePayrollListResult {
  const { t } = useTranslation();
  const [generatedPayrolls, setGeneratedPayrolls] = useState<GeneratedPayrollRow[]>([]);
  const [previewPayrolls, setPreviewPayrolls] = useState<PreviewPayrollRow[]>([]);
  const [meta, setMeta] = useState<PayrollListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchIdRef = useRef(0);

  const load = useCallback(
    async (isRefresh = false) => {
      if (companyId == null) {
        setGeneratedPayrolls([]);
        setPreviewPayrolls([]);
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
        const res = await fetchPayrollList(companyId, { month, year, page, limit });

        if (fetchId !== fetchIdRef.current) {
          return;
        }

        if (res.success) {
          setGeneratedPayrolls(res.data?.generated_payrolls ?? []);
          setPreviewPayrolls(res.data?.preview_payrolls ?? []);
          setMeta(res.meta ?? null);
        } else {
          setGeneratedPayrolls([]);
          setPreviewPayrolls([]);
          setMeta(null);
          setError(res.message?.trim() || t('home.payrollManagement.apiError'));
        }
      } catch (e) {
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        if (axios.isAxiosError(e) && e.response?.status === 403) {
          setAccessDenied(true);
          setError(t('home.payrollManagement.accessDenied'));
        } else {
          setError(readApiError(e));
        }
        setGeneratedPayrolls([]);
        setPreviewPayrolls([]);
        setMeta(null);
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [companyId, limit, month, page, t, year],
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

  const displayRows = useMemo(
    () => toDisplayRows(generatedPayrolls, previewPayrolls, statusFilter),
    [generatedPayrolls, previewPayrolls, statusFilter],
  );

  return {
    generatedPayrolls,
    previewPayrolls,
    displayRows,
    meta,
    loading,
    refreshing,
    error,
    accessDenied,
    refresh,
    retry,
  };
}
