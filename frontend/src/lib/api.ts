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

// Untyped call sites rely on this default; new code should pass an explicit T.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiClient<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { data, headers, body, ...customConfig } = options;
  
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

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

  const response = await fetch(`${API_BASE}${endpoint}`, config);
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

export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
