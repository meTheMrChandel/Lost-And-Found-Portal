import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi, UserProfile } from "../api/auth";
import { storage } from "../api/client";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore authenticated session on app launch
  useEffect(() => {
    const loadSession = async () => {
      try {
        const token = await storage.getItem("access_token");
        if (token) {
          const profile = await authApi.getProfile();
          setUser(profile);
          await storage.setItem("user_data", JSON.stringify(profile));
        }
      } catch (e) {
        // Cached profile fallback if offline
        const cachedUser = await storage.getItem("user_data");
        if (cachedUser) {
          try {
            setUser(JSON.parse(cachedUser));
          } catch {
            // ignore
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await authApi.login(email, password);
      // Dual-mode response supports { access, refresh } or { data: { tokens: { ... }, user: ... } }
      const access = data.access || data.tokens?.access || data.data?.tokens?.access;
      const refresh = data.refresh || data.tokens?.refresh || data.data?.tokens?.refresh;
      const profile = data.user || data.data?.user;

      if (access) {
        await storage.setItem("access_token", access);
      }
      if (refresh) {
        await storage.setItem("refresh_token", refresh);
      }

      if (profile) {
        setUser(profile);
        await storage.setItem("user_data", JSON.stringify(profile));
      } else {
        const fetchedProfile = await authApi.getProfile();
        setUser(fetchedProfile);
        await storage.setItem("user_data", JSON.stringify(fetchedProfile));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await storage.removeItem("access_token");
      await storage.removeItem("refresh_token");
      await storage.removeItem("user_data");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    try {
      const profile = await authApi.getProfile();
      setUser(profile);
      await storage.setItem("user_data", JSON.stringify(profile));
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
