import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchMyLedger } from '@src/api/fetchMyLedger';
import type {
  CompanyLedgerMeta,
  LedgerTransaction,
  LedgerTransactionType,
} from '@src/types/companyLedger';
import { readApiError } from '@src/utils/readApiError';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export type UseMyLedgerOptions = {
  companyId: number | null;
  enabled?: boolean;
  fromDate?: string | null;
  toDate?: string | null;
  transactionType?: LedgerTransactionType | null;
  onError?: (message: string) => void;
};

export function useMyLedger({
  companyId,
  enabled = true,
  fromDate = null,
  toDate = null,
  transactionType = null,
  onError,
}: UseMyLedgerOptions) {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  const [meta, setMeta] = useState<CompanyLedgerMeta | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearchRaw] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const fetchIdRef = useRef(0);
  const loadedPageRef = useRef(0);
  const endReachedLock = useRef(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const hasDateRange =
    fromDate != null &&
    fromDate.trim() !== '' &&
    toDate != null &&
    toDate.trim() !== '';

  useEffect(() => {
    const id = setTimeout(
      () => setDebouncedSearch(search.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(id);
  }, [search]);

  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
  }, []);

  const loadFirst = useCallback(async () => {
    if (companyId == null || !enabled) {
      setTransactions([]);
      setOpeningBalance(null);
      setMeta(null);
      setHasNextPage(false);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const fetchId = ++fetchIdRef.current;
    loadedPageRef.current = 0;
    setLoading(true);
    setError(null);
    endReachedLock.current = false;
    try {
      const res = await fetchMyLedger(companyId, {
        page_no: 1,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        ...(hasDateRange ? { from_date: fromDate!, to_date: toDate! } : {}),
        ...(transactionType != null ? { transaction_type: transactionType } : {}),
      });
      if (fetchId !== fetchIdRef.current) {
        return;
      }
      if (!res.success) {
        const msg = res.message?.trim() || 'Could not load ledger.';
        setError(msg);
        onErrorRef.current?.(msg);
        setTransactions([]);
        setOpeningBalance(null);
        setMeta(null);
        setHasNextPage(false);
        return;
      }
      const list = res.data?.list ?? [];
      setTransactions(list);
      setOpeningBalance(res.data?.opening_balance ?? 0);
      setMeta(res.meta);
      setHasNextPage(list.length === PAGE_SIZE);
      loadedPageRef.current = 1;
    } catch (e) {
      if (fetchId !== fetchIdRef.current) {
        return;
      }
      const msg = readApiError(e);
      setError(msg);
      onErrorRef.current?.(msg);
      setTransactions([]);
      setOpeningBalance(null);
      setMeta(null);
      setHasNextPage(false);
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    companyId,
    debouncedSearch,
    enabled,
    fromDate,
    hasDateRange,
    toDate,
    transactionType,
  ]);

  useEffect(() => {
    loadFirst().catch(() => {});
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (
      companyId == null ||
      !enabled ||
      !hasNextPage ||
      loadingMore ||
      loading
    ) {
      return;
    }
    setLoadingMore(true);
    try {
      const nextPage = loadedPageRef.current + 1;
      const res = await fetchMyLedger(companyId, {
        page_no: nextPage,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        ...(hasDateRange ? { from_date: fromDate!, to_date: toDate! } : {}),
        ...(transactionType != null ? { transaction_type: transactionType } : {}),
      });
      if (!res.success) {
        return;
      }
      const list = res.data?.list ?? [];
      setTransactions(prev => [...prev, ...list]);
      setMeta(res.meta);
      setHasNextPage(list.length === PAGE_SIZE);
      loadedPageRef.current = nextPage;
    } catch {
      // keep existing rows on pagination failure
    } finally {
      setLoadingMore(false);
    }
  }, [
    companyId,
    debouncedSearch,
    enabled,
    fromDate,
    hasDateRange,
    hasNextPage,
    loading,
    loadingMore,
    toDate,
    transactionType,
  ]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirst();
  }, [loadFirst]);

  const tryLoadMore = useCallback(() => {
    if (endReachedLock.current) {
      return;
    }
    endReachedLock.current = true;
    loadMore()
      .catch(() => {})
      .finally(() => {
        endReachedLock.current = false;
      });
  }, [loadMore]);

  const retry = useCallback(() => {
    loadFirst().catch(() => {});
  }, [loadFirst]);

  return {
    transactions,
    openingBalance,
    meta,
    hasNextPage,
    loading,
    loadingMore,
    refreshing,
    error,
    search,
    setSearch,
    refresh,
    tryLoadMore,
    retry,
    hasDateRange,
  };
}
