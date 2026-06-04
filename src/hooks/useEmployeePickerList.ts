import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchEmployeeList } from '@src/api/fetchEmployeeList';
import type { EmployeeListItem, EmployeeListMeta } from '@src/types/employeeList';
import { readApiError } from '@src/utils/readApiError';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 500;

export type UseEmployeePickerListOptions = {
  companyId: number | null;
  onError?: (message: string) => void;
};

export function useEmployeePickerList({
  companyId,
  onError,
}: UseEmployeePickerListOptions) {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [meta, setMeta] = useState<EmployeeListMeta | null>(null);
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
    if (companyId == null) {
      setEmployees([]);
      setMeta(null);
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
      const res = await fetchEmployeeList(companyId, {
        search: debouncedSearch,
        page: 1,
        limit: PAGE_SIZE,
      });
      if (fetchId !== fetchIdRef.current) {
        return;
      }
      if (!res.success) {
        const msg = res.message?.trim() || 'Could not load employees.';
        setError(msg);
        onErrorRef.current?.(msg);
        setEmployees([]);
        setMeta(null);
        return;
      }
      setEmployees(res.data ?? []);
      setMeta(res.meta);
      loadedPageRef.current = 1;
    } catch (e) {
      if (fetchId !== fetchIdRef.current) {
        return;
      }
      const msg = readApiError(e);
      setError(msg);
      onErrorRef.current?.(msg);
      setEmployees([]);
      setMeta(null);
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [companyId, debouncedSearch]);

  useEffect(() => {
    loadFirst().catch(() => {});
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (companyId == null || meta == null || loadingMore || loading) {
      return;
    }
    if (meta.is_last_page || loadedPageRef.current >= meta.total_pages) {
      return;
    }
    setLoadingMore(true);
    try {
      const nextPage = loadedPageRef.current + 1;
      const res = await fetchEmployeeList(companyId, {
        search: debouncedSearch,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      if (!res.success) {
        return;
      }
      setEmployees(prev => [...prev, ...(res.data ?? [])]);
      setMeta(res.meta);
      loadedPageRef.current = nextPage;
    } catch {
      // keep existing rows
    } finally {
      setLoadingMore(false);
    }
  }, [companyId, debouncedSearch, loading, loadingMore, meta]);

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
    employees,
    meta,
    loading,
    loadingMore,
    refreshing,
    error,
    search,
    setSearch,
    refresh,
    tryLoadMore,
    retry,
  };
}
