import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { chatApi } from "../api/chat";
import { notificationsApi } from "../api/notifications";
import { useAuth } from "./AuthContext";

interface ActivityContextType {
  unreadNotifications: number;
  unreadMessages: number;
  /** Fetch both counts again, e.g. after reading something. */
  refresh: () => void;
  setUnreadNotifications: (count: number) => void;
}

const ActivityContext = createContext<ActivityContextType>({
  unreadNotifications: 0,
  unreadMessages: 0,
  refresh: () => {},
  setUnreadNotifications: () => {},
});

const POLL_MS = 60_000;

/** Unread notification and message counts for the badges, kept fresh while the app is open. */
export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  // Keyed by id, so refreshing the profile doesn't restart polling
  const userId = user?.id;
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const inFlight = useRef(false);

  const refresh = useCallback(() => {
    if (!userId || inFlight.current) return;
    inFlight.current = true;
    Promise.allSettled([notificationsApi.getUnreadCount(), chatApi.getConversations()])
      .then(([notifications, conversations]) => {
        if (notifications.status === "fulfilled") setUnreadNotifications(notifications.value);
        if (conversations.status === "fulfilled") {
          setUnreadMessages(conversations.value.reduce((sum, c) => sum + (c.unread_count || 0), 0));
        }
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnreadNotifications(0);
      setUnreadMessages(0);
      return;
    }
    refresh();
    let timer: ReturnType<typeof setInterval> | null = setInterval(refresh, POLL_MS);
    // Pause while the app is in the background, and catch up when it returns
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
        if (!timer) timer = setInterval(refresh, POLL_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [userId, refresh]);

  const value = useMemo(
    () => ({ unreadNotifications, unreadMessages, refresh, setUnreadNotifications }),
    [unreadNotifications, unreadMessages, refresh],
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
};

export const useActivity = () => useContext(ActivityContext);
