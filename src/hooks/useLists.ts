import { useCallback, useEffect, useMemo, useState } from "react";

export interface ProspectListSummary {
  id: string;
  name: string;
  prospectCount: number;
  createdAt?: string;
  updatedAt?: string;
}

const LISTS_API_BASE = import.meta.env.VITE_LISTS_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || "";

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response | null = null;
  try {
    response = await fetch(input, init);
  } catch (err) {
    console.error("List service request failed", err);
    throw new Error(
      "Unable to reach the list service. Ensure it is running and accessible (check VITE_LISTS_API_BASE_URL).",
    );
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

interface ListsResponse {
  data: ProspectListSummary[];
}

interface CreateListResponse {
  id: string;
  name: string;
}

interface AddMembersResponse {
  listId: string;
  added: number;
  alreadyPresent: number;
}

export function useLists() {
  const [lists, setLists] = useState<ProspectListSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson<ListsResponse>(`${LISTS_API_BASE}/api/lists`);
      setLists(payload.data);
      console.info("[lists] Loaded", payload.data.length, "lists");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load lists.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const createList = useCallback(async (name: string) => {
    console.info("[lists] Creating list", name);
    const payload = await fetchJson<CreateListResponse>(`${LISTS_API_BASE}/api/lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await loadLists();
    console.info("[lists] Created list", payload.id);
    return payload;
  }, [loadLists]);

  const addProspectsToList = useCallback(async (listId: string, prospectIds: string[]) => {
    console.info("[lists] Adding", prospectIds.length, "prospects to list", listId);
    const payload = await fetchJson<AddMembersResponse>(`${LISTS_API_BASE}/api/lists/${encodeURIComponent(listId)}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectIds }),
    });
    console.info("[lists] Updated list", listId, payload);
    return payload;
  }, []);

  return useMemo(
    () => ({
      lists,
      loading,
      error,
      refresh: loadLists,
      createList,
      addProspectsToList,
    }),
    [lists, loading, error, loadLists, createList, addProspectsToList],
  );
}
