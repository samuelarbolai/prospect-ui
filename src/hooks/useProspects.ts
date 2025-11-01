import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Prospect, ProspectFilters } from "../types";

const PAGE_SIZE = 50;
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

interface ProspectsResponse {
  data: Prospect[];
  nextPageToken?: string;
}

function buildQuery(filters: ProspectFilters, pageSize: number, pageToken?: string) {
  const params = new URLSearchParams();
  params.set("pageSize", String(pageSize));
  if (pageToken) params.set("pageToken", pageToken);
  if (filters.listIds.length > 0) params.set("listIds", filters.listIds.join(","));
  if (filters.priorities.length > 0) params.set("priorities", filters.priorities.join(","));
  if (filters.statuses.length > 0) params.set("statuses", filters.statuses.join(","));
  if (filters.searchName.trim()) params.set("search", filters.searchName.trim());
  return params.toString();
}

export function useProspects(filters: ProspectFilters) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const nextTokenRef = useRef<string | undefined>(undefined);
  const filtersRef = useRef(filters);

  const fetchProspects = useCallback(
    async (reset = false) => {
      setLoading(true);
      setError(null);

      try {
        const token = reset ? undefined : nextTokenRef.current;
        const query = buildQuery(filters, PAGE_SIZE, token);
        const response = await fetch(`${API_BASE}/api/prospects?${query}`);
        if (!response.ok) {
          throw new Error(`Failed to load prospects (${response.status})`);
        }
        const payload = (await response.json()) as ProspectsResponse;
        nextTokenRef.current = payload.nextPageToken;
        setHasMore(Boolean(payload.nextPageToken));
        setProspects((prev) => (reset ? payload.data : [...prev, ...payload.data]));
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load prospects.");
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  const resetAndLoad = useCallback(() => {
    nextTokenRef.current = undefined;
    setProspects([]);
    fetchProspects(true);
  }, [fetchProspects]);

  useEffect(() => {
    resetAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prev = filtersRef.current;
    if (
      prev.listIds !== filters.listIds ||
      prev.priorities !== filters.priorities ||
      prev.statuses !== filters.statuses ||
      prev.searchName !== filters.searchName
    ) {
      filtersRef.current = filters;
      resetAndLoad();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.listIds, filters.priorities, filters.statuses, filters.searchName]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchProspects(false);
    }
  }, [fetchProspects, hasMore, loading]);

  return useMemo(
    () => ({
      prospects,
      loading,
      error,
      hasMore,
      loadMore,
      refresh: () => resetAndLoad(),
    }),
    [prospects, loading, error, hasMore, loadMore, resetAndLoad],
  );
}
