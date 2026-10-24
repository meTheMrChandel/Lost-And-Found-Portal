import { apiClient } from "./client";

export interface RegisteredValuable {
  id: string;
  name: string;
  category: {
    id: string;
    slug: string;
    name: string;
  };
  description: string;
  serial_number: string;
  qr_uuid: string;
  is_active: boolean;
  deactivated_at: string | null;
  scan_url: string;
  created_at: string;
}

export interface QRScanResult {
  item_name: string;
  category: string;
  owner_name: string;
  qr_uuid: string;
  is_active: boolean;
  notice?: string;
}

export const itemsApi = {
  async getRegisteredItems(): Promise<RegisteredValuable[]> {
    const res = await apiClient.get("/items/");
    const payload = res.data?.data || res.data;
    return Array.isArray(payload) ? payload : payload?.results || [];
  },

  async registerItem(data: {
    name: string;
    category: string;
    description: string;
    serial_number: string;
  }): Promise<RegisteredValuable> {
    const res = await apiClient.post("/items/", data);
    return res.data?.data || res.data;
  },

  async toggleActive(itemId: string): Promise<any> {
    const res = await apiClient.post(`/items/${itemId}/toggle-active/`);
    return res.data;
  },

  async deleteItem(itemId: string): Promise<any> {
    const res = await apiClient.delete(`/items/${itemId}/`);
    return res.data;
  },

  async scanQR(qrUuid: string): Promise<QRScanResult> {
    const res = await apiClient.get(`/items/scan/${qrUuid}/`);
    return res.data?.data || res.data;
  },

  async getSticker(itemId: string): Promise<{ svg: string; scan_url: string }> {
    const res = await apiClient.get(`/items/${itemId}/sticker/?format=json`);
    return res.data?.data || res.data;
  },
};
