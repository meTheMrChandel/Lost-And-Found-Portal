import { apiClient } from "./client";

export interface Participant {
  id: string;
  full_name: string;
  // Not sent for student-to-student conversations
  email?: string;
  registration_number: string;
}

/** A student found by their exact registration number. */
export interface StudentLookup {
  id: string;
  full_name: string;
  registration_number: string;
  existing_conversation_id: string | null;
}

export interface Conversation {
  id: string;
  conversation_type: "owner_admin" | "finder_admin" | "direct" | "student";
  match_id?: string;
  match?: {
    id: string;
    lost_item_name: string;
    found_item_name: string;
    status: string;
  };
  participants: Participant[];
  is_direct_approved: boolean;
  // Student conversations: started from a sticker scan, or a message request by registration number
  origin?: "qr_scan" | "registration_search" | "";
  request_status?: "pending" | "accepted" | "declined";
  requested_by?: string | null;
  item?: { id: string; name: string; owner_id: string } | null;
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
  /**
   * The student's own thread with the admin office. Chat is admin-mediated, so a post
   * has no conversation of its own; the backend reuses the existing thread if there is one.
   */
  async openAdminConversation(): Promise<Conversation> {
    const res = await apiClient.post("/chat/conversations/", { conversation_type: "owner_admin" });
    return res.data?.data || res.data;
  },

  async getConversations(): Promise<Conversation[]> {
    const res = await apiClient.get("/chat/conversations/");
    const payload = res.data?.data || res.data;
    return Array.isArray(payload) ? payload : payload?.results || [];
  },

  async getConversation(convId: string): Promise<Conversation> {
    const res = await apiClient.get(`/chat/conversations/${convId}/`);
    return res.data?.data || res.data;
  },

  async lookupStudent(registrationNumber: string): Promise<StudentLookup> {
    const res = await apiClient.get("/chat/students/lookup/", {
      params: { registration_number: registrationNumber },
    });
    return res.data?.data || res.data;
  },

  /** Starts a message request; returns the existing conversation if there already is one. */
  async sendRequest(registrationNumber: string, message: string): Promise<Conversation> {
    const res = await apiClient.post("/chat/requests/", { registration_number: registrationNumber, message });
    return res.data?.data || res.data;
  },

  async respondToRequest(convId: string, action: "accept" | "decline"): Promise<Conversation> {
    const res = await apiClient.post(`/chat/requests/${convId}/respond/`, { action });
    return res.data?.data || res.data;
  },

  /** Chat with the owner of a scanned sticker; opens straight away. */
  async openQRConversation(qrUuid: string, message?: string): Promise<Conversation> {
    const res = await apiClient.post("/chat/qr/", { qr_uuid: qrUuid, message });
    return res.data?.data || res.data;
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

  async toggleBlock(userId: string): Promise<{ is_blocked: boolean; message: string }> {
    const res = await apiClient.post("/chat/block/", { user_id: userId });
    return res.data;
  },
};
