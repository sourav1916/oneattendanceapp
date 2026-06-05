import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchSubscriptionPackages } from '@src/api/fetchSubscriptionPackages';
import type { SubscriptionPackage } from '@src/types/subscriptionPackage';
import { readApiError } from '@src/utils/readApiError';

export function useSubscriptionPackages(companyId: number | null) {
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIdRef = useRef(0);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (companyId == null) {
      setPackages([]);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const fetchId = ++fetchIdRef.current;
    if (mode === 'initial') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const res = await fetchSubscriptionPackages(companyId);
      if (fetchId !== fetchIdRef.current) {
        return;
      }
      if (!res.success) {
        const msg =
          res.message?.trim() || 'Could not load subscription packages.';
        setError(msg);
        setPackages([]);
        return;
      }
      setPackages(res.data ?? []);
    } catch (err) {
      if (fetchId !== fetchIdRef.current) {
        return;
      }
      setError(readApiError(err));
      setPackages([]);
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [companyId]);

  useEffect(() => {
    load('initial').catch(() => {});
  }, [load]);

  const refresh = useCallback(() => {
    load('refresh').catch(() => {});
  }, [load]);

  const retry = useCallback(() => {
    load('initial').catch(() => {});
  }, [load]);

  return {
    packages,
    loading,
    refreshing,
    error,
    refresh,
    retry,
  };
}
