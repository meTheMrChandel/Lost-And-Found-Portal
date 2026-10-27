const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface RequestOptions extends RequestInit {
  data?: unknown;
}

interface ApiErrorBody {
  message?: string;
  errors?: Record<string, unknown>;
}

/** List endpoints return a bare array, a DRF paginated page, or the { data } envelope. */
export type ListResponse<T> = T[] | { data?: T[]; results?: T[] };

export function unwrapList<T>(res: ListResponse<T> | null | undefined): T[] {
  if (Array.isArray(res)) return res;
  return res?.data || res?.results || [];
}

// Shared across callers: refresh tokens rotate and are single-use, so concurrent
// 401s must wait on one refresh instead of each spending the same token.
let refreshInFlight: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refresh = localStorage.getItem("refresh_token");
      if (!refresh) return null;
      try {
        const res = await fetch(`${API_BASE}/auth/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
        const tokens: { access: string; refresh?: string } = await res.json();
        localStorage.setItem("access_token", tokens.access);
        if (tokens.refresh) localStorage.setItem("refresh_token", tokens.refresh);
        return tokens.access;
      } catch {
        // Refresh token expired or revoked: the session is over
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// Untyped call sites rely on this default; new code should pass an explicit T.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiClient<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  let response = await sendRequest(endpoint, options, token);

  // Access tokens are short-lived (15 min): on a 401, refresh once and retry.
  // Auth endpoints are excluded, since a 401 there means bad credentials.
  if (response.status === 401 && token && !endpoint.startsWith("/auth/")) {
    // If another request already refreshed while this one was in flight, reuse that token
    const current = localStorage.getItem("access_token");
    const newToken = current && current !== token ? current : await refreshAccessToken();
    if (newToken) {
      response = await sendRequest(endpoint, options, newToken);
    }
  }

  return parseResponse<T>(response);
}

function sendRequest(endpoint: string, options: RequestOptions, token: string | null) {
  const { data, headers, body, ...customConfig } = options;

  const isFormData =
    (typeof FormData !== "undefined" && body instanceof FormData) ||
    (typeof FormData !== "undefined" && data instanceof FormData);

  const defaultHeaders: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (!isFormData) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  let requestBody: BodyInit | null | undefined = undefined;
  if (data !== undefined) {
    requestBody =
      data instanceof FormData ? data : typeof data === "string" ? data : JSON.stringify(data);
  } else if (body !== undefined) {
    requestBody = body;
  }

  const config: RequestInit = {
    ...customConfig,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    body: requestBody,
  };

  return fetch(`${API_BASE}${endpoint}`, config);
}

async function parseResponse<T>(response: Response): Promise<T> {
  let result: ApiErrorBody | null = null;
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    result = await response.json();
  } else {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Server returned error (${response.status}): ${response.statusText}`);
    }
    return text as T;
  }

  if (!response.ok) {
    let errorMsg = result?.message;
    if (result?.errors && typeof result.errors === "object" && Object.keys(result.errors).length > 0) {
      const fieldErrors = Object.values(result.errors).flat().join(" ");
      if (fieldErrors) {
        errorMsg = fieldErrors;
      }
    }
    throw new Error(errorMsg || `Request failed (${response.status})`);
  }

  return result as T;
}

/** WebSocket URL on the same host as the REST API (e.g. ws://localhost:8000/ws/...). */
export function websocketUrl(path: string): string {
  const api = new URL(API_BASE);
  const protocol = api.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${api.host}${path}`;
}

export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
