import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardSetSummary } from '@miscellary/shared';
import { listPublicSets } from './endpoints';

export type DiscoverySort = 'new' | 'popular';

export function useDiscovery(sort: DiscoverySort) {
  const [sets, setSets] = useState<CardSetSummary[]>([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);

  const load = useCallback(
    async (page: string | null = null, refresh = false) => {
      if (page && request.current) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      if (page) {
        setLoadingMore(true);
        setMoreError(null);
      } else {
        setRefreshing(refresh);
        setLoading(!refresh);
        setLoadingMore(false);
        setError(null);
        setMoreError(null);
      }
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const result = await listPublicSets(sort, page, controller.signal);
        if (request.current !== controller) return;
        setSets((previous) =>
          page
            ? [...new Map([...previous, ...result.results].map((set) => [set.id, set])).values()]
            : result.results,
        );
        setCount(result.count);
        setNext(result.next);
      } catch (e) {
        if (request.current !== controller) return;
        const message = controller.signal.aborted
          ? 'The shelf took too long to load. Please try again.'
          : e instanceof Error
            ? e.message
            : 'Could not load the shelf.';
        if (page) setMoreError(message);
        else setError(message);
      } finally {
        clearTimeout(timeout);
        if (request.current === controller) {
          request.current = null;
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [sort],
  );

  useEffect(() => {
    setSets([]);
    setCount(0);
    setNext(null);
    void load();
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [load]);

  return {
    sets,
    count,
    loading,
    refreshing,
    loadingMore,
    error,
    moreError,
    hasMore: next !== null,
    refresh: () => void load(null, true),
    retry: () => void load(),
    loadMore: () => {
      if (next && !loading && !refreshing) void load(next);
    },
  };
}
