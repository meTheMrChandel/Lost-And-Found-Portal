import axios from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Bulletproof host IP detection across Expo Go, emulators, and physical devices:
const debuggerHost =
  Constants.expoGoConfig?.debuggerHost ||
  (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
  (Constants as any).manifest?.debuggerHost ||
  Constants.expoConfig?.hostUri;

const expoHost = debuggerHost ? debuggerHost.split(":")[0] : null;

// Fallback to computer's LAN IP when running on physical device outside debugger
const LAN_FALLBACK_HOST = "172.26.13.61";

const DEFAULT_API_BASE =
  Platform.OS === "web"
    ? "http://127.0.0.1:8000/api/v1"
    : expoHost
    ? `http://${expoHost}:8000/api/v1`
    : `http://${LAN_FALLBACK_HOST}:8000/api/v1`;

// Release builds point at the deployed server, e.g. https://lostandfound.iitrpr.ac.in/api/v1
const CONFIGURED_API_BASE = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

export const API_URL = CONFIGURED_API_BASE || DEFAULT_API_BASE;

/** Origin of the API server (no /api/v1), used for media files and WebSockets. */
export const API_ORIGIN = API_URL.replace(/\/api\/v\d+$/, "");

/** WebSocket URL on the API server, e.g. wss://host/ws/chat/<id>/ for an https API. */
export function websocketUrl(path: string): string {
  return API_ORIGIN.replace(/^http/, "ws") + path;
}

// Platform-aware secure storage helper
export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === "web") {
        await AsyncStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (e) {
      console.warn("Storage setItem error:", e);
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === "web") {
        return await AsyncStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn("Storage getItem error:", e);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === "web") {
        await AsyncStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (e) {
      console.warn("Storage removeItem error:", e);
    }
  },
};

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request interceptor to inject Bearer access token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await storage.getItem("access_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Mutex / promise queue to prevent simultaneous multiple refresh requests
let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string | null) => void) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (token: string | null) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

// Response interceptor to automatically refresh expired tokens
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Do not attempt refresh on auth login, OTP or refresh endpoints
    const requestUrl = originalRequest?.url || "";
    const isAuthEndpoint =
      requestUrl.includes("/auth/login/") ||
      requestUrl.includes("/auth/token/refresh/") ||
      requestUrl.includes("/auth/refresh/") ||
      requestUrl.includes("/auth/request-otp/") ||
      requestUrl.includes("/auth/verify-otp/");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Wait for active refresh to complete
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(async (newToken) => {
            if (newToken) {
              if (originalRequest.headers) {
                (originalRequest.headers as any).Authorization = `Bearer ${newToken}`;
              }
              resolve(apiClient(originalRequest));
            } else {
              // Refresh failed, retry public GET requests anonymously
              if (originalRequest.method?.toLowerCase() === "get" && originalRequest.headers) {
                if (typeof (originalRequest.headers as any).delete === "function") {
                  (originalRequest.headers as any).delete("Authorization");
                  (originalRequest.headers as any).delete("authorization");
                }
                delete (originalRequest.headers as any).Authorization;
                delete (originalRequest.headers as any).authorization;
                resolve(axios(originalRequest));
              } else {
                reject(error);
              }
            }
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = await storage.getItem("refresh_token");
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        const refreshRes = await axios.post(`${API_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const newAccess = refreshRes.data.access;
        if (newAccess) {
          await storage.setItem("access_token", newAccess);
          if (refreshRes.data.refresh) {
            await storage.setItem("refresh_token", refreshRes.data.refresh);
          }
          onTokenRefreshed(newAccess);
          if (originalRequest.headers) {
            (originalRequest.headers as any).Authorization = `Bearer ${newAccess}`;
          }
          return apiClient(originalRequest);
        } else {
          throw new Error("No access token in refresh response");
        }
      } catch (refreshErr) {
        // Refresh token failed -> clear credentials
        onTokenRefreshed(null);
        await storage.removeItem("access_token");
        await storage.removeItem("refresh_token");
        await storage.removeItem("user_data");

        // If the original request was a GET request (e.g. public feed/categories), retry anonymously
        if (originalRequest.method?.toLowerCase() === "get" && originalRequest.headers) {
          if (typeof (originalRequest.headers as any).delete === "function") {
            (originalRequest.headers as any).delete("Authorization");
            (originalRequest.headers as any).delete("authorization");
          }
          delete (originalRequest.headers as any).Authorization;
          delete (originalRequest.headers as any).authorization;
          return axios(originalRequest);
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    error.formattedMessage = describeError(error);
    return Promise.reject(error);
  }
);

function fieldLabel(field: string): string {
  return field.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Turns a failed request into a message for the user. */
function describeError(error: any): string {
  const response = error.response;
  // No response at all: the server couldn't be reached
  if (!response) return "Can't reach the server. Check your connection and try again.";

  const data = response.data;
  if (data && typeof data === "object") {
    const errors = data.errors && typeof data.errors === "object" ? data.errors : {};
    // SimpleJWT reports a bad token as {detail, code, messages} field errors
    const tokenInvalid = Array.isArray(errors.code) && errors.code.includes("token_not_valid");
    if (tokenInvalid || data.code === "token_not_valid") return "Your session has expired. Please sign in again.";

    // The envelope always carries `errors`, often empty: only use it when it has entries
    const fieldMessages = Object.entries(errors).flatMap(([field, messages]) =>
      (Array.isArray(messages) ? messages : [messages]).map((m) => {
        const text = String(m);
        if (field === "non_field_errors" || field === "detail") return text;
        const label = fieldLabel(field);
        return text.toLowerCase().startsWith(label.toLowerCase()) ? text : `${label}: ${text}`;
      })
    );
    if (fieldMessages.length > 0) return fieldMessages.join(" ");
    if (data.message) return String(data.message);
    if (data.detail) return String(data.detail);
  }

  if (response.status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (response.status >= 500) return "Something went wrong on the server. Please try again shortly.";
  if (response.status === 404) return "We couldn't find that. It may have been removed.";
  return `Request failed (${response.status}).`;
}

/** Message to show for a failed request, from the server when it sent one. */
export function errorMessage(err: any, fallback: string): string {
  return err?.formattedMessage || err?.message || fallback;
}
