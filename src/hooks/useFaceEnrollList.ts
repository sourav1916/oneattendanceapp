import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchFaceEnrollList } from '@src/api/fetchFaceEnrollList';
import type {
  FaceEnrollListItem,
  FaceEnrollListMeta,
} from '@src/types/faceEnrollList';
import { readApiError } from '@src/utils/readApiError';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 500;

export type UseFaceEnrollListOptions = {
  companyId: number | null;
  onError?: (message: string) => void;
};

export function useFaceEnrollList({
  companyId,
  onError,
}: UseFaceEnrollListOptions) {
  const [employees, setEmployees] = useState<FaceEnrollListItem[]>([]);
  const [meta, setMeta] = useState<FaceEnrollListMeta | null>(null);
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
      const res = await fetchFaceEnrollList(companyId, {
        search: debouncedSearch,
        page: 1,
        limit: PAGE_SIZE,
      });
      if (fetchId !== fetchIdRef.current) {
        return;
      }
      if (!res.success) {
        const msg = res.message?.trim() || 'Could not load face enroll list.';
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
    if (
      meta.is_last_page ||
      (meta.total_pages > 0 && loadedPageRef.current >= meta.total_pages)
    ) {
      return;
    }
    setLoadingMore(true);
    try {
      const nextPage = loadedPageRef.current + 1;
      const res = await fetchFaceEnrollList(companyId, {
        search: debouncedSearch,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      const chunk = res.data;
      if (!res.success || chunk == null) {
        return;
      }
      if (chunk.length === 0) {
        setMeta(m => (m ? { ...m, is_last_page: true } : m));
        return;
      }
      loadedPageRef.current = nextPage;
      setEmployees(prev => [...prev, ...chunk]);
      if (res.meta) {
        setMeta(res.meta);
      }
    } catch {
      /* keep list */
    } finally {
      setLoadingMore(false);
      endReachedLock.current = false;
    }
  }, [companyId, meta, debouncedSearch, loadingMore, loading]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadFirst().catch(() => {});
  }, [loadFirst]);

  const retry = useCallback(() => {
    loadFirst().catch(() => {});
  }, [loadFirst]);

  const tryLoadMore = useCallback(() => {
    if (endReachedLock.current || loading || loadingMore || meta == null) {
      return;
    }
    if (
      meta.is_last_page ||
      (meta.total_pages > 0 && loadedPageRef.current >= meta.total_pages)
    ) {
      return;
    }
    endReachedLock.current = true;
    loadMore().catch(() => {});
  }, [loadMore, loading, loadingMore, meta]);

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
