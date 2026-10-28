const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface RequestOptions extends RequestInit {
  data?: unknown;
}

interface ApiErrorBody {
  message?: string;
  code?: string;
  errors?: Record<string, unknown>;
}

/**
 * List endpoints come in three shapes: a bare array, the { success, data: [...] }
 * envelope, or a DRF paginated page { count, results } (e.g. /matching/, /items/,
 * /notifications/). The envelope may also wrap a page.
 */
export type ListResponse<T> = T[] | { data?: T[] | { results?: T[] }; results?: T[] };

export function unwrapList<T>(res: ListResponse<T> | null | undefined): T[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return res?.data?.results || res?.results || [];
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

  return fetch(`${API_BASE}${endpoint}`, config).catch((err) => {
    // fetch only rejects when the server can't be reached at all
    if (err instanceof TypeError) {
      throw new ApiError("Can't reach the server. Check your internet connection and try again.", 0);
    }
    throw err;
  });
}

async function parseResponse<T>(response: Response): Promise<T> {
  let result: ApiErrorBody | null = null;
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    result = await response.json();
  } else {
    const text = await response.text();
    if (!response.ok) {
      throw new ApiError(describeError(response.status, null), response.status);
    }
    return text as T;
  }

  if (!response.ok) {
    throw new ApiError(describeError(response.status, result), response.status, result?.code);
  }

  return result as T;
}

/** Thrown by apiClient; `message` is already worded for showing to the user. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const MESSAGES_BY_CODE: Record<string, string> = {
  token_not_valid: "Your session has expired. Please log in again.",
  authentication_failed: "Your session has expired. Please log in again.",
  not_authenticated: "Please log in to continue.",
  no_active_account: "Incorrect email or password.",
  permission_denied: "You don't have permission to do that.",
};

function fieldLabel(field: string): string {
  return field.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function describeError(status: number, body: ApiErrorBody | null): string {
  const errors = body?.errors ?? {};
  // SimpleJWT reports a bad token as field errors ({detail, code, messages}), not as a code
  const tokenInvalid = Array.isArray(errors.code) && errors.code.includes("token_not_valid");
  const code = tokenInvalid ? "token_not_valid" : body?.code;
  if (code && MESSAGES_BY_CODE[code]) return MESSAGES_BY_CODE[code];

  if (status === 429) {
    const wait = body?.message?.match(/(\d+) seconds?/);
    return wait
      ? `Too many attempts. Please wait ${wait[1]} seconds and try again.`
      : "Too many attempts. Please wait a moment and try again.";
  }
  if (status >= 500) return "Something went wrong on our side. Please try again in a moment.";

  // Label each field error so "This field is required." says which field
  const fieldMessages = Object.entries(errors).flatMap(([field, messages]) =>
    (Array.isArray(messages) ? messages : [messages]).map((m) => {
      const text = String(m);
      if (field === "non_field_errors" || field === "detail") return text;
      const label = fieldLabel(field);
      return text.toLowerCase().startsWith(label.toLowerCase()) ? text : `${label}: ${text}`;
    })
  );
  if (fieldMessages.length > 0) return fieldMessages.join(" ");

  if (status === 404 && (!body?.message || body.message === "Not found.")) {
    return "We couldn't find that. It may have been removed.";
  }
  return body?.message || `Request failed (${status}).`;
}

/**
 * WebSocket URL on the same host as the REST API (e.g. ws://localhost:8000/ws/...).
 * API_BASE may be relative ("/api/v1" behind nginx), so resolve it against the page.
 */
export function websocketUrl(path: string): string {
  const api = new URL(API_BASE, window.location.href);
  const protocol = api.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${api.host}${path}`;
}

/**
 * Uploaded files come back as server-relative paths ("/media/posts/x.jpg"), which the
 * browser would otherwise request from the frontend host. Resolve them against the API.
 */
export function mediaUrl(path: string): string {
  // A relative API_BASE means the API (and /media/) is served from this same host
  if (!/^https?:\/\//.test(API_BASE)) return path;
  return new URL(path, API_BASE).href;
}

export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
