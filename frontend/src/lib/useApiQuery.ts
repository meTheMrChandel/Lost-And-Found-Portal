"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, getErrorMessage } from "@/lib/api";

interface QueryState<T> {
  key: string;
  data: T | undefined;
  error: string;
}

/**
 * Fetches `endpoint` whenever it changes. Each response is stored together
 * with the request it answers, so a slow response for an old endpoint (e.g. a
 * previous search term) can never overwrite a newer one. Pass `null` to skip.
 */
export function useApiQuery<T>(endpoint: string | null, fallbackError: string) {
  const [refreshCount, setRefreshCount] = useState(0);
  const [state, setState] = useState<QueryState<T> | null>(null);
  const key = `${endpoint}#${refreshCount}`;

  useEffect(() => {
    if (endpoint === null) return;
    let cancelled = false;
    apiClient<T>(endpoint)
      .then((res) => {
        if (!cancelled) setState({ key, data: res, error: "" });
      })
      .catch((err) => {
        if (!cancelled) {
          setState((prev) => ({
            key,
            data: prev?.data,
            error: getErrorMessage(err, fallbackError),
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, key, fallbackError]);

  const refresh = useCallback(() => setRefreshCount((c) => c + 1), []);
  const loading = endpoint !== null && state?.key !== key;

  return {
    // Previous data stays available while a new request is in flight
    data: state?.data,
    loading,
    error: !loading && state ? state.error : "",
    refresh,
  };
}
