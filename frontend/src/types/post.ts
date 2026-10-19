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
  created_at: string;
  updated_at?: string;
  expires_at?: string;
}
