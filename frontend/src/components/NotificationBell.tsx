"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";

interface NotificationItem {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

type NotificationListResponse =
  | NotificationItem[]
  | { results?: NotificationItem[]; data?: NotificationItem[] };

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  // Reference time for "x ago" labels; refreshed whenever the list is fetched
  const [now, setNow] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = () => {
    apiClient<{ unread_count: number }>("/notifications/unread-count/")
      .then((res) => setUnreadCount(res.unread_count || 0))
      .catch(() => {
        // ignore unauthenticated or network errors silently
      });
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await apiClient<NotificationListResponse>("/notifications/");
      // Handle both DRF paginated { results: [...] } and direct array
      const items = Array.isArray(res) ? res : res?.results || res?.data || [];
      setNotifications(items);
      setNow(Date.now());
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiClient(`/notifications/${id}/read/`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient("/notifications/mark-all-read/", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleOpen = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Math.floor((now - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-full text-[#1C1C1E] hover:bg-[#EFEAE0] transition-colors focus:outline-none"
        aria-label="Notifications"
        title="Campus Notifications"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-[#D94F3B] rounded-full ring-2 ring-[#FAF7F2] animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-[#EFEAE0] z-50 overflow-hidden text-left">
          <div className="flex items-center justify-between px-4 py-3 bg-[#FAF7F2] border-b border-[#EFEAE0]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[#1C1C1E]">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#D94F3B]/10 text-[#D94F3B] rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-[#047857] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-[#EFEAE0]">
            {loading ? (
              <div className="p-6 text-center text-xs text-gray-500">Loading alerts...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                <p className="text-2xl mb-1">📭</p>
                No notifications yet.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => !item.is_read && handleMarkAsRead(item.id)}
                  className={`p-3.5 transition-colors cursor-pointer hover:bg-stone-50 ${
                    !item.is_read ? "bg-emerald-50/40" : "bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!item.is_read && (
                          <span className="w-2 h-2 rounded-full bg-[#047857] shrink-0" />
                        )}
                        <h4 className="text-xs font-bold text-[#1C1C1E] truncate">
                          {item.title}
                        </h4>
                      </div>
                      <p className="text-xs text-[#4B5563] line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                      <span className="text-[10px] text-[#9CA3AF] mt-1 block">
                        {formatTimeAgo(item.created_at)}
                      </span>
                    </div>

                    {item.action_url && (
                      <Link
                        href={item.action_url}
                        className="text-[10px] font-semibold text-[#047857] bg-emerald-100/60 hover:bg-emerald-200/80 px-2 py-1 rounded transition-colors self-start shrink-0"
                      >
                        View →
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-2 bg-[#FAF7F2] border-t border-[#EFEAE0] flex justify-between items-center text-xs">
            <Link
              href="/chat"
              onClick={() => setIsOpen(false)}
              className="font-medium text-[#047857] hover:underline"
            >
              💬 Open Chat
            </Link>
            <span className="text-[11px] text-[#6B7280]">IIT Ropar Portal</span>
          </div>
        </div>
      )}
    </div>
  );
}
