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
const LAN_FALLBACK_HOST = "192.168.31.9";

const DEFAULT_API_BASE =
  Platform.OS === "web"
    ? "http://127.0.0.1:8000/api/v1"
    : expoHost
    ? `http://${expoHost}:8000/api/v1`
    : `http://${LAN_FALLBACK_HOST}:8000/api/v1`;

export const API_URL = DEFAULT_API_BASE;

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

    // Format server error message
    const data = error.response?.data;
    let message = "Network request failed";
    if (data) {
      if (data.errors && typeof data.errors === "object") {
        message = Object.values(data.errors).flat().join(" ");
      } else if (data.message) {
        message = data.message;
      } else if (data.detail) {
        message = data.detail;
      }
    }
    error.formattedMessage = message;
    return Promise.reject(error);
  }
);
