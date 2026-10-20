export interface Category {
  slug: string;
  name: string;
  icon?: string;
  order: number;
  is_sensitive: boolean;
}

export interface PostImage {
  id: string;
  image: string;
  thumbnail?: string;
  order: number;
  uploaded_at: string;
}

export type PostType = "LOST" | "FOUND";

export type PostStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "INFO_REQUESTED"
  | "EXPIRED"
  | "RETURNED"
  | "HIDDEN";

export interface Post {
  id: string;
  title: string;
  post_type: PostType;
  category: string;
  category_name?: string;
  description?: string;
  last_seen_place: string;
  last_seen_time: string;
  hidden_proof?: string;
  reward_amount: string | number;
  status: PostStatus;
  admin_remarks?: string;
  images: PostImage[];
  author_name?: string;
  author_registration_number?: string;
  author?: {
    id: string;
    email: string;
    full_name: string;
    registration_number: string;
    department: string;
    program_year: string;
    hostel?: string;
    phone?: string;
    is_banned: boolean;
  };
  author_email?: string;
  is_sla_breached?: boolean;
  reviewed_by_email?: string;
  reviewed_at?: string;
  audit_history?: Array<{
    id: string;
    admin_email?: string;
    action: string;
    previous_status?: string;
    new_status?: string;
    notes?: string;
    created_at: string;
  }>;
  created_at: string;
  updated_at?: string;
  expires_at?: string;
}

export interface AbuseReport {
  id: string;
  post: string;
  post_title?: string;
  reporter?: string;
  reporter_name?: string;
  reporter_email?: string;
  reason: "spam" | "fake" | "inappropriate" | "other";
  description?: string;
  is_resolved: boolean;
  resolved_by_email?: string;
  created_at: string;
}

export interface AdminStats {
  users: {
    total: number;
    students: number;
    banned: number;
    new_this_week: number;
  };
  posts: {
    total: number;
    lost: number;
    found: number;
    pending: number;
    approved: number;
    info_requested: number;
    returned: number;
    rejected: number;
    hidden: number;
    sla_breached: number;
  };
  abuse_reports: {
    pending: number;
  };
  category_breakdown: Array<{
    slug: string;
    name: string;
    posts_count: number;
  }>;
  recent_activity: Array<{
    id: string;
    post_title?: string;
    admin_email?: string;
    action: string;
    notes?: string;
    created_at: string;
  }>;
}
