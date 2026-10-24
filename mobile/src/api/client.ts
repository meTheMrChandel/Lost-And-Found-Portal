import axios from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Default API URL based on platform:
// - Android Emulator: 10.0.2.2 points to host machine
// - iOS Simulator / Local: 127.0.0.1 / localhost
const DEFAULT_API_BASE =
  Platform.OS === "android"
    ? "http://10.0.2.2:8000/api/v1"
    : "http://127.0.0.1:8000/api/v1";

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

// Response interceptor to automatically refresh expired tokens
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
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
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        // Refresh token failed -> clear credentials
        await storage.removeItem("access_token");
        await storage.removeItem("refresh_token");
        await storage.removeItem("user_data");
        return Promise.reject(refreshErr);
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
