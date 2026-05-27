import { useCallback, useEffect, useRef, useState } from 'react';

import { companyInviteApi } from '@src/api/invitePackageApi';
import type {
  CompanyInviteItem,
  CompanyInviteListMeta,
} from '@src/types/companyInvite';
import { readApiError } from '@src/utils/readApiError';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 500;

export type UseCompanyInvitesOptions = {
  companyId: number | null;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
};

export function useCompanyInvites({
  companyId,
  onError,
  onSuccess,
}: UseCompanyInvitesOptions) {
  const [invites, setInvites] = useState<CompanyInviteItem[]>([]);
  const [meta, setMeta] = useState<CompanyInviteListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearchRaw] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mutating, setMutating] = useState(false);

  const fetchIdRef = useRef(0);
  const loadedPageRef = useRef(0);
  const endReachedLock = useRef(false);
  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  onErrorRef.current = onError;
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  const setSearch = useCallback((v: string) => setSearchRaw(v), []);

  const loadFirst = useCallback(async () => {
    if (companyId == null) {
      setInvites([]);
      setMeta(null);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const fId = ++fetchIdRef.current;
    loadedPageRef.current = 0;
    setLoading(true);
    setError(null);
    endReachedLock.current = false;
    try {
      const res = await companyInviteApi.list(companyId, {
        search: debouncedSearch,
        page: 1,
        limit: PAGE_SIZE,
      });
      if (fId !== fetchIdRef.current) {
        return;
      }
      if (!res.success) {
        const msg = res.message?.trim() || 'Could not load invites.';
        setError(msg);
        onErrorRef.current?.(msg);
        setInvites([]);
        setMeta(null);
        return;
      }
      setInvites(res.data ?? []);
      setMeta(res.meta);
      loadedPageRef.current = 1;
    } catch (e) {
      if (fId !== fetchIdRef.current) {
        return;
      }
      const msg = readApiError(e);
      setError(msg);
      onErrorRef.current?.(msg);
      setInvites([]);
      setMeta(null);
    } finally {
      if (fId === fetchIdRef.current) {
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
    if (meta.is_last_page || (meta.total_pages > 0 && loadedPageRef.current >= meta.total_pages)) {
      return;
    }
    setLoadingMore(true);
    try {
      const nextPage = loadedPageRef.current + 1;
      const res = await companyInviteApi.list(companyId, {
        search: debouncedSearch,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      const chunk = res.data;
      if (!res.success || chunk == null || chunk.length === 0) {
        if (chunk?.length === 0) {
          setMeta(m => (m ? { ...m, is_last_page: true } : m));
        }
        return;
      }
      loadedPageRef.current = nextPage;
      setInvites(prev => [...prev, ...chunk]);
      if (res.meta) {
        setMeta(res.meta);
      }
    } catch { /* keep list */ } finally {
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
    if (meta.is_last_page || (meta.total_pages > 0 && loadedPageRef.current >= meta.total_pages)) {
      return;
    }
    endReachedLock.current = true;
    loadMore().catch(() => {});
  }, [loadMore, loading, loadingMore, meta]);

  const cancelInvite = useCallback(async (token: string): Promise<boolean> => {
    if (companyId == null) {
      return false;
    }
    setMutating(true);
    try {
      const res = await companyInviteApi.cancel(companyId, token);
      if (res.success) {
        onSuccessRef.current?.(res.message || 'Invite cancelled.');
        loadFirst().catch(() => {});
        return true;
      }
      onErrorRef.current?.(res.message || 'Cancel failed.');
      return false;
    } catch (e) {
      onErrorRef.current?.(readApiError(e));
      return false;
    } finally {
      setMutating(false);
    }
  }, [companyId, loadFirst]);

  const resendInvite = useCallback(async (inviteId: number): Promise<boolean> => {
    if (companyId == null) {
      return false;
    }
    setMutating(true);
    try {
      const res = await companyInviteApi.resend(companyId, inviteId);
      if (res.success) {
        onSuccessRef.current?.(res.message || 'Invite resent.');
        return true;
      }
      onErrorRef.current?.(res.message || 'Resend failed.');
      return false;
    } catch (e) {
      onErrorRef.current?.(readApiError(e));
      return false;
    } finally {
      setMutating(false);
    }
  }, [companyId]);

  return {
    invites,
    meta,
    loading,
    loadingMore,
    refreshing,
    error,
    search,
    setSearch,
    refresh,
    loadMore: tryLoadMore,
    retry,
    cancelInvite,
    resendInvite,
    mutating,
  };
}
