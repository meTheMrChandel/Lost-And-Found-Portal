import { apiClient, API_ORIGIN } from "./client";

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon?: string;
}

export interface PostImageItem {
  id: string;
  image_url: string;
  is_primary?: boolean;
}

export interface Post {
  id: string;
  post_type: "lost" | "found";
  title: string;
  category: Category | string;
  category_name?: string;
  description: string;
  campus_location: string;
  last_seen_place?: string;
  incident_date: string;
  last_seen_time?: string;
  status: string;
  reward_amount?: number;
  custody_mode?: string;
  custody_location?: string;
  images: PostImageItem[];
  author?: {
    id?: string;
    full_name: string;
    registration_number: string;
  };
  author_name?: string;
  author_registration_number?: string;
  created_at: string;
}

/** A row from My Reports, as the API sends it (post_type and status are uppercase). */
export interface MyReport {
  id: string;
  title: string;
  post_type: "LOST" | "FOUND";
  category: string;
  category_name?: string;
  status: string;
  last_seen_place: string;
  last_seen_time: string;
  reward_amount?: string | number;
  admin_remarks?: string;
  images: PostImageItem[];
  created_at: string;
  expires_at?: string | null;
  description?: string;
}

function absoluteImages(raw: any[] | undefined): PostImageItem[] {
  return (raw || []).map((img: any, idx: number) => {
    let url = img.image_url || img.image || "";
    if (url && url.startsWith("/") && !url.startsWith("//")) url = `${API_ORIGIN}${url}`;
    return { id: img.id || `img_${idx}`, image_url: url, is_primary: idx === 0 };
  });
}

export function normalizePost(raw: any): Post {
  const isLost = (raw.post_type || "").toLowerCase() === "lost";
  const postType: "lost" | "found" = isLost ? "lost" : "found";

  const images: PostImageItem[] = (raw.images || []).map((img: any, idx: number) => {
    let rawUrl = img.image_url || img.image || (typeof img === "string" ? img : "");
    if (rawUrl && rawUrl.startsWith("/") && !rawUrl.startsWith("//")) {
      rawUrl = `${API_ORIGIN}${rawUrl}`;
    }
    return {
      id: img.id || `img_${idx}`,
      image_url: rawUrl,
      is_primary: idx === 0 || img.is_primary,
    };
  });

  const categoryName =
    raw.category_name ||
    (typeof raw.category === "object" ? raw.category?.name : null) ||
    raw.category ||
    "General";

  return {
    id: raw.id,
    post_type: postType,
    title: raw.title || "Belonging",
    category: raw.category || "general",
    category_name: categoryName,
    description: raw.description || "",
    campus_location: raw.last_seen_place || raw.campus_location || "IIT Ropar Campus",
    last_seen_place: raw.last_seen_place || raw.campus_location,
    incident_date: raw.last_seen_time || raw.incident_date || raw.created_at || new Date().toISOString(),
    last_seen_time: raw.last_seen_time || raw.incident_date,
    status: raw.status || "APPROVED",
    reward_amount: raw.reward_amount ? Number(raw.reward_amount) : undefined,
    custody_mode: raw.custody_mode || raw.custody_location,
    custody_location: raw.custody_location || raw.custody_mode,
    images,
    author: {
      id: raw.author?.id,
      full_name: raw.author_name || raw.author?.full_name || "Campus Member",
      registration_number: raw.author_registration_number || raw.author?.registration_number || "",
    },
    author_name: raw.author_name || raw.author?.full_name,
    author_registration_number: raw.author_registration_number || raw.author?.registration_number,
    created_at: raw.created_at || new Date().toISOString(),
  };
}

export const postsApi = {
  async getCategories(): Promise<Category[]> {
    const res = await apiClient.get("/posts/categories/");
    return res.data?.data || (Array.isArray(res.data) ? res.data : []);
  },

  async getFeed(params?: {
    type?: string;
    post_type?: string;
    category?: string;
    search?: string;
    ordering?: string;
    include_pending?: boolean;
  }): Promise<Post[]> {
    const res = await apiClient.get("/posts/feed/", { params });
    const payload = res.data?.data || res.data;
    const rawList = Array.isArray(payload) ? payload : payload?.results || [];
    return rawList.map(normalizePost);
  },

  async getPostDetail(id: string): Promise<Post> {
    const res = await apiClient.get(`/posts/${id}/`);
    const raw = res.data?.data || res.data;
    return normalizePost(raw);
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

  async getMyReports(): Promise<MyReport[]> {
    const res = await apiClient.get("/posts/lost/my-reports/");
    const payload = res.data?.data || res.data;
    const rows: any[] = Array.isArray(payload) ? payload : payload?.results || [];
    return rows.map((row) => ({ ...row, images: absoluteImages(row.images) }));
  },

  /** Full report for its author, including the description the list leaves out. */
  async getMyReportDetail(postId: string): Promise<MyReport> {
    const res = await apiClient.get(`/posts/lost/${postId}/`);
    const row = res.data?.data || res.data;
    return { ...row, images: absoluteImages(row.images) };
  },

  /** Editing a report while info is requested sends it back to admin review. */
  async updateReport(
    postId: string,
    changes: { description: string; last_seen_place: string }
  ): Promise<{ message?: string }> {
    const res = await apiClient.patch(`/posts/lost/${postId}/`, changes);
    return res.data;
  },

  async withdrawReport(postId: string): Promise<{ message?: string }> {
    const res = await apiClient.delete(`/posts/lost/${postId}/`);
    return res.data;
  },

  async reportAbuse(postId: string, reason: string): Promise<any> {
    const res = await apiClient.post(`/posts/${postId}/report-abuse/`, { reason });
    return res.data;
  },

  async renewPost(postId: string): Promise<{ success?: boolean; message?: string }> {
    const res = await apiClient.post(`/posts/${postId}/renew/`);
    return res.data;
  },
};
