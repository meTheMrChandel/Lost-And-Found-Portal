import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authApi, UserProfile } from "../api/auth";
import { onSessionExpired, storage } from "../api/client";
import { useToast } from "../ui/Toast";

interface AuthContextType {
  user: UserProfile | null;
  /** True only while the saved session is restored at launch. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Use a profile the server just returned, e.g. after editing it. */
  setProfile: (profile: UserProfile) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function clearSession() {
  await storage.removeItem("access_token");
  await storage.removeItem("refresh_token");
  await storage.removeItem("user_data");
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setProfile = useCallback(async (profile: UserProfile) => {
    setUser(profile);
    await storage.setItem("user_data", JSON.stringify(profile));
  }, []);

  // Restore the session on launch
  useEffect(() => {
    const loadSession = async () => {
      try {
        const token = await storage.getItem("access_token");
        if (!token) return;

        // Open straight away with the profile saved last time: the hosted server can take
        // up to a minute to wake up, and the app should not wait on it
        const cachedUser = await storage.getItem("user_data");
        if (cachedUser) {
          try {
            setUser(JSON.parse(cachedUser));
            setIsLoading(false);
          } catch {
            // ignore a corrupt cache and wait for the server instead
          }
        }

        try {
          await setProfile(await authApi.getProfile());
        } catch {
          // Offline or slow: keep the cached profile. If the session could not be renewed,
          // the client has already removed the tokens, so sign out here too.
          if (!(await storage.getItem("access_token"))) {
            setUser(null);
            await storage.removeItem("user_data");
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [setProfile]);

  // The server refused to renew the session (signed out elsewhere, password changed, too old)
  const signedIn = useRef(false);
  signedIn.current = !!user;
  useEffect(
    () =>
      onSessionExpired(() => {
        if (signedIn.current) toast.show("Your session has expired. Please sign in again.", "info");
        setUser(null);
      }),
    [toast],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.login(email, password);
      // Dual-mode response supports { access, refresh } or { data: { tokens: { ... }, user: ... } }
      const access = data.access || data.tokens?.access || data.data?.tokens?.access;
      const refresh = data.refresh || data.tokens?.refresh || data.data?.tokens?.refresh;
      if (access) await storage.setItem("access_token", access);
      if (refresh) await storage.setItem("refresh_token", refresh);

      // The login response only carries the basics; the profile adds department, photo and so on
      let profile: UserProfile | undefined = data.user || data.data?.user;
      try {
        profile = await authApi.getProfile();
      } catch (err) {
        if (!profile) throw err;
      }
      await setProfile(profile!);
      return profile!;
    },
    [setProfile],
  );

  const logout = useCallback(async () => {
    // Blacklist the refresh token on the server, as the website does; sign out locally regardless
    const refresh = await storage.getItem("refresh_token");
    if (refresh) await authApi.logout(refresh).catch(() => {});
    await clearSession();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      await setProfile(await authApi.getProfile());
    } catch {
      // keep what we have
    }
  }, [setProfile]);

  const value = useMemo(
    () => ({ user, isLoading, login, logout, refreshProfile, setProfile }),
    [user, isLoading, login, logout, refreshProfile, setProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
