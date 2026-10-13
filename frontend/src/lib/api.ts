const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface RequestOptions extends RequestInit {
  data?: any;
}

export async function apiClient<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { data, headers, ...customConfig } = options;
  
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const config: RequestInit = {
    ...customConfig,
    headers: defaultHeaders,
    body: data ? JSON.stringify(data) : undefined,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  let result: any = null;
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    result = await response.json();
  } else {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Server returned error (${response.status}): ${response.statusText}`);
    }
    return text as any;
  }

  if (!response.ok) {
    const errorMsg = result?.message || (result?.errors ? Object.values(result.errors).flat().join(" ") : `Request failed (${response.status})`);
    throw new Error(errorMsg);
  }

  return result;
}
