import { useCallback, useEffect, useRef, useState } from 'react';

import { bankAccountApi } from '@src/api/bankAccountApi';
import type { BankAccountListItem } from '@src/types/bankAccount';
import { readApiError } from '@src/utils/readApiError';

export type UseMyBankAccountsOptions = {
  companyId: number | null;
  enabled?: boolean;
  onError?: (message: string) => void;
};

export function useMyBankAccounts({
  companyId,
  enabled = true,
  onError,
}: UseMyBankAccountsOptions) {
  const [accounts, setAccounts] = useState<BankAccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIdRef = useRef(0);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const load = useCallback(
    async (isRefresh = false) => {
      if (companyId == null || !enabled) {
        setAccounts([]);
        setError(null);
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

      try {
        const res = await bankAccountApi.fetchMyAccounts(companyId, {
          page: 1,
          limit: 50,
          status: 'active',
          sort_by: 'created_at',
          sort_order: 'DESC',
        });
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        if (!res.success) {
          const msg = res.message?.trim() || 'Could not load bank accounts.';
          setAccounts([]);
          setError(msg);
          onErrorRef.current?.(msg);
          return;
        }
        setAccounts(res.data ?? []);
      } catch (e) {
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        const msg = readApiError(e);
        setAccounts([]);
        setError(msg);
        onErrorRef.current?.(msg);
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [companyId, enabled],
  );

  useEffect(() => {
    load(false).catch(() => {});
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  const retry = useCallback(() => {
    load(false).catch(() => {});
  }, [load]);

  return {
    accounts,
    loading,
    refreshing,
    error,
    refresh,
    retry,
    reload: () => load(false),
  };
}
