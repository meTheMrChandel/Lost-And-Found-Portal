import { apiClient } from "./client";

export interface AppConfig {
  min_supported_version: string;
  latest_version: string;
  update_url: string;
}

export async function getAppConfig(): Promise<AppConfig> {
  const res = await apiClient.get("/app-config/");
  return res.data?.data || res.data;
}

/** Compares dotted versions numerically ("1.10.0" > "1.9.2"); returns -1, 0 or 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}
