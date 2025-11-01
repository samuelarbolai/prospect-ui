import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

interface ListOptionsResponse {
  options: string[];
}

export function useListOptions() {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/list-options`);
        if (!response.ok) {
          throw new Error(`Failed to load list options (${response.status})`);
        }
        const payload = (await response.json()) as ListOptionsResponse;
        setOptions(payload.options ?? []);
      } catch (error) {
        console.error("Failed to load list options", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { options, loading };
}
