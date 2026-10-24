import { apiClient } from "./client";

export interface NotificationItem {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

export const notificationsApi = {
  async getNotifications(unreadOnly = false): Promise<NotificationItem[]> {
    const params = unreadOnly ? { unread: "true" } : undefined;
    const res = await apiClient.get("/notifications/", { params });
    const payload = res.data?.data || res.data;
    return Array.isArray(payload) ? payload : payload?.results || [];
  },

  async getUnreadCount(): Promise<number> {
    const res = await apiClient.get("/notifications/unread-count/");
    return res.data?.unread_count || 0;
  },

  async markRead(id: string): Promise<any> {
    const res = await apiClient.post(`/notifications/${id}/read/`);
    return res.data;
  },

  async markAllRead(): Promise<any> {
    const res = await apiClient.post("/notifications/mark-all-read/");
    return res.data;
  },
};
