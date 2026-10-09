"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@/types/auth";
import { apiClient } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiClient<{ success: boolean; data: User }>("/users/me/");
        if (res.success && res.data) {
          setUser(res.data);
        }
      } catch (err) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await apiClient<{ access: string; refresh: string; user: User }>("/auth/login/", {
      method: "POST",
      data: { email, password: pass },
    });

    localStorage.setItem("access_token", res.access);
    localStorage.setItem("refresh_token", res.refresh);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      const refresh = localStorage.getItem("refresh_token");
      await apiClient("/auth/logout/", {
        method: "POST",
        data: { refresh },
      });
    } catch (e) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
