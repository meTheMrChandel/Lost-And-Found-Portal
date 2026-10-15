export interface User {
  id: string;
  email: string;
  registration_number: string;
  full_name: string;
  department: string;
  program_year: string;
  hostel?: string;
  phone?: string;
  role: "admin" | "user";
  is_staff: boolean;
  is_superuser?: boolean;
  is_banned?: boolean;
  ban_reason?: string;
}

export interface AdminInvite {
  id: string;
  token: string;
  email: string;
  invited_by_email?: string;
  is_used: boolean;
  used_at?: string;
  expires_at: string;
  created_at: string;
  is_expired: boolean;
}

export interface PostAuditLog {
  id: string;
  post: string;
  post_title?: string;
  admin?: string;
  admin_email?: string;
  action: string;
  previous_status?: string;
  new_status?: string;
  notes?: string;
  created_at: string;
}

export interface SiteSettings {
  match_threshold: number;
  post_expiry_days: number;
  otp_expiry_seconds: number;
  otp_max_attempts: number;
  updated_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  access?: string;
  refresh?: string;
  errors?: Record<string, string[]>;
}
