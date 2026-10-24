import { apiClient } from "./client";

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon?: string;
}

export interface Post {
  id: string;
  post_type: "lost" | "found";
  title: string;
  category: Category;
  description: string;
  campus_location: string;
  incident_date: string;
  status: string;
  reward_amount?: number;
  custody_mode?: string;
  images: Array<{
    id: string;
    image_url: string;
    is_primary: boolean;
  }>;
  author: {
    id: string;
    full_name: string;
    registration_number: string;
  };
  created_at: string;
}

export const postsApi = {
  async getCategories(): Promise<Category[]> {
    const res = await apiClient.get("/posts/categories/");
    return res.data?.data || (Array.isArray(res.data) ? res.data : []);
  },

  async getFeed(params?: {
    type?: string;
    category?: string;
    search?: string;
    ordering?: string;
  }): Promise<Post[]> {
    const res = await apiClient.get("/posts/feed/", { params });
    const payload = res.data?.data || res.data;
    return Array.isArray(payload) ? payload : payload?.results || [];
  },

  async createLostPost(formData: FormData): Promise<any> {
    const res = await apiClient.post("/posts/lost/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  async createFoundPost(formData: FormData): Promise<any> {
    const res = await apiClient.post("/posts/found/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  async getMyReports(): Promise<Post[]> {
    const res = await apiClient.get("/posts/lost/my-reports/");
    const payload = res.data?.data || res.data;
    return Array.isArray(payload) ? payload : payload?.results || [];
  },

  async reportAbuse(postId: string, reason: string): Promise<any> {
    const res = await apiClient.post(`/posts/${postId}/report-abuse/`, { reason });
    return res.data;
  },

  async renewPost(postId: string): Promise<any> {
    const res = await apiClient.post(`/posts/${postId}/renew/`);
    return res.data;
  },
};
