import { apiClient } from "./client";

export interface Participant {
  id: string;
  full_name: string;
  email: string;
  registration_number: string;
}

export interface Conversation {
  id: string;
  conversation_type: "owner_admin" | "finder_admin" | "direct";
  match_id?: string;
  match?: {
    id: string;
    lost_item_name: string;
    found_item_name: string;
    status: string;
  };
  participants: Participant[];
  is_direct_approved: boolean;
  unread_count: number;
  last_message?: {
    content: string;
    created_at: string;
    sender_name: string;
  };
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation: string;
  sender_id: string;
  sender: Participant;
  content: string;
  is_read: boolean;
  read_at?: string;
  is_me: boolean;
  created_at: string;
}

export const chatApi = {
  async getConversations(): Promise<Conversation[]> {
    const res = await apiClient.get("/chat/conversations/");
    const payload = res.data?.data || res.data;
    return Array.isArray(payload) ? payload : payload?.results || [];
  },

  async getMessages(convId: string, since?: string): Promise<ChatMessage[]> {
    const params = since ? { since } : undefined;
    const res = await apiClient.get(`/chat/conversations/${convId}/messages/`, { params });
    const payload = res.data?.data || res.data;
    return Array.isArray(payload) ? payload : payload?.results || [];
  },

  async sendMessage(convId: string, content: string): Promise<ChatMessage> {
    const res = await apiClient.post(`/chat/conversations/${convId}/messages/`, { content });
    return res.data?.data || res.data;
  },

  async markRead(convId: string): Promise<any> {
    const res = await apiClient.post(`/chat/conversations/${convId}/read/`);
    return res.data;
  },

  async toggleBlock(blockedUserId: string, reason?: string): Promise<any> {
    const res = await apiClient.post("/chat/block/", {
      blocked_user_id: blockedUserId,
      reason: reason || "Inappropriate behavior",
    });
    return res.data;
  },
};
