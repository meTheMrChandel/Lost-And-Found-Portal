/**
 * Campus admin endpoints (/adminpanel/, /matching/, /feedback/), used by the admin console.
 * Every call needs a staff account; the backend answers 403 otherwise.
 */
import { apiClient } from "./client";
import { absoluteImages, PostImageItem } from "./posts";

export type PostStatus = "PENDING" | "APPROVED" | "REJECTED" | "INFO_REQUESTED" | "EXPIRED" | "RETURNED" | "HIDDEN";
export const POST_STATUSES: PostStatus[] = [
  "PENDING",
  "INFO_REQUESTED",
  "APPROVED",
  "EXPIRED",
  "RETURNED",
  "REJECTED",
  "HIDDEN",
];

export type ReviewAction = "APPROVE" | "REJECT" | "INFO_REQUESTED" | "HIDE" | "CHANGE_CATEGORY" | "ASSIGN" | "DELETE";

export interface AuditLogEntry {
  id: string;
  post: string | null;
  post_title: string;
  admin: string | null;
  admin_email?: string;
  action: string;
  previous_status: string;
  new_status: string;
  notes: string;
  created_at: string;
}

export interface AdminStats {
  users: { total: number; students: number; banned: number; new_this_week: number };
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
    expired: number;
    expiring_soon: number;
    sla_breached: number;
  };
  lifecycle?: { review_sla_hours: number; post_expiry_days: number; renewal_reminder_days: number };
  abuse_reports: { pending: number };
  category_breakdown: { slug: string; name: string; posts_count: number }[];
  recent_activity: AuditLogEntry[];
  review_sla_hours?: number;
}

export interface CaseListItem {
  id: string;
  title: string;
  post_type: "LOST" | "FOUND";
  category: string;
  category_name: string;
  status: PostStatus;
  last_seen_place: string;
  last_seen_time: string;
  reward_amount: string;
  admin_remarks: string;
  author_name?: string;
  author_email?: string;
  author_registration_number?: string;
  images: PostImageItem[];
  assigned_to: string | null;
  assigned_to_email: string | null;
  is_sla_breached: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface CaseDetail extends Omit<CaseListItem, "author_name" | "author_email" | "author_registration_number"> {
  description: string;
  hidden_proof: string;
  custody_location: "" | "finder" | "admin_office" | "security_office";
  inform_admin_privately: boolean;
  author: {
    id: string;
    email: string;
    registration_number: string;
    full_name: string;
    department?: string;
    program_year?: string;
    hostel?: string;
    phone?: string;
    is_banned: boolean;
  } | null;
  reviewed_by_email?: string;
  reviewed_at: string | null;
  registered_item: {
    id: string;
    name: string;
    owner_name: string;
    owner_email: string;
    owner_registration_number: string;
  } | null;
  audit_history: AuditLogEntry[];
  updated_at: string;
}

export interface CaseFilters {
  status?: string;
  post_type?: string;
  search?: string;
  sla_breached?: boolean;
  assigned_to?: "me" | "none";
}

export interface StaffMember {
  id: string;
  email: string;
  full_name: string;
}

export interface AdminUser extends StaffMember {
  registration_number: string;
  department: string;
  program_year: string;
  hostel: string;
  phone: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  is_banned: boolean;
  ban_reason: string;
  date_joined: string;
}

export interface AbuseReport {
  id: string;
  post: string;
  post_title: string;
  post_status: PostStatus;
  reporter: string | null;
  reporter_name?: string;
  reporter_email?: string;
  reason: "spam" | "fake" | "inappropriate" | "other";
  description: string;
  is_resolved: boolean;
  resolved_by_email?: string;
  created_at: string;
}

export interface AdminInvite {
  id: string;
  token: string;
  email: string;
  invited_by_email?: string;
  is_used: boolean;
  used_at: string | null;
  expires_at: string;
  created_at: string;
  is_expired: boolean;
}

export interface SiteSettings {
  match_threshold: number;
  post_expiry_days: number;
  otp_expiry_seconds: number;
  otp_max_attempts: number;
  admin_review_sla_hours: number;
  abuse_auto_hide_threshold: number;
  updated_at?: string;
}

export interface FeedbackEntry {
  id: string;
  rating: number;
  message: string;
  page: string;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
}

// ── Matching ────────────────────────────────────────────────────────────────

export type MatchStatus =
  | "suggested"
  | "confirmed"
  | "proof_pending"
  | "verified"
  | "handed_over"
  | "closed"
  | "dismissed";
export const MATCH_STATUSES: MatchStatus[] = [
  "suggested",
  "confirmed",
  "proof_pending",
  "verified",
  "handed_over",
  "closed",
  "dismissed",
];

export interface MatchPost {
  id: string;
  title: string;
  description: string;
  post_type: "LOST" | "FOUND";
  status: PostStatus;
  category: { id: string; slug: string; name: string; icon?: string; is_sensitive?: boolean } | null;
  last_seen_place: string;
  last_seen_time: string;
  reward_amount: string;
  custody_location: string;
  inform_admin_privately: boolean;
  author: { id: string; full_name: string; email: string; phone?: string; registration_number: string } | null;
  images: string[];
  hidden_proof: string | null;
  created_at: string;
}

export interface MatchListItem {
  id: string;
  score: number;
  status: MatchStatus;
  meeting_mode: "" | "direct" | "office";
  owner_notified_at: string | null;
  lost_post: MatchPost;
  found_post: MatchPost;
  created_at: string;
  updated_at: string;
}

export interface ProofQuestion {
  question: string;
  answer: string;
  is_correct: boolean;
}

export interface MatchAuditEntry {
  id: string;
  action: string;
  from_status: string;
  to_status: string;
  notes: string;
  created_at: string;
  admin_name: string;
}

export interface MatchDetail extends MatchListItem {
  proof_questions: ProofQuestion[];
  proof_verified_at: string | null;
  handover_code_used: boolean;
  handed_over_at: string | null;
  reward_amount_settled: string | null;
  reward_settled_at: string | null;
  admin_notes: string;
  audit_logs: MatchAuditEntry[];
}

export interface ScoreBreakdown {
  category: number;
  date: number;
  location: number;
  text: number;
}

/**
 * The engine's per-factor scores are only kept in the MATCH_SUGGESTED audit note, e.g.
 * "... Breakdown: cat=1.0, date=0.85, loc=0.8, text=0.4".
 */
export function scoreBreakdown(match: MatchDetail): ScoreBreakdown | null {
  const note = match.audit_logs.find((entry) => entry.action === "MATCH_SUGGESTED")?.notes || "";
  const m = note.match(/cat=([\d.]+),\s*date=([\d.]+),\s*loc=([\d.]+),\s*text=([\d.]+)/);
  if (!m) return null;
  return { category: Number(m[1]), date: Number(m[2]), location: Number(m[3]), text: Number(m[4]) };
}

/** Admin endpoints answer {"success", "data"}; unwrap it. */
function unwrap<T>(body: any): T {
  return body && typeof body === "object" && "data" in body ? body.data : body;
}

function withImages<T extends { images?: any[] }>(row: T): T {
  return { ...row, images: absoluteImages(row.images) };
}

export const adminApi = {
  async getStatistics(): Promise<AdminStats> {
    const res = await apiClient.get("/adminpanel/statistics/");
    return unwrap<AdminStats>(res.data);
  },

  // ── Case queue ────────────────────────────────────────────────────────────
  async getCases(filters: CaseFilters = {}): Promise<CaseListItem[]> {
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.post_type) params.post_type = filters.post_type;
    if (filters.search?.trim()) params.search = filters.search.trim();
    if (filters.sla_breached) params.sla_breached = "true";
    if (filters.assigned_to) params.assigned_to = filters.assigned_to;
    const res = await apiClient.get("/adminpanel/posts/", { params });
    return unwrap<CaseListItem[]>(res.data).map(withImages);
  },

  async getCase(postId: string): Promise<CaseDetail> {
    const res = await apiClient.get(`/adminpanel/posts/${postId}/`);
    return withImages(unwrap<CaseDetail>(res.data));
  },

  /** Returns the updated case, or null after DELETE. */
  async reviewCase(
    postId: string,
    body: { action: ReviewAction; remarks?: string; new_category?: string; assign_to?: string }
  ): Promise<{ message: string; post: CaseDetail | null }> {
    const res = await apiClient.post(`/adminpanel/posts/${postId}/review/`, { remarks: "", ...body });
    const post = res.data?.data ? withImages(res.data.data as CaseDetail) : null;
    return { message: res.data?.message || "Done.", post };
  },

  async getStaff(): Promise<StaffMember[]> {
    const res = await apiClient.get("/adminpanel/users/", { params: { staff: "true" } });
    return unwrap<StaffMember[]>(res.data);
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  async getUsers(search = ""): Promise<AdminUser[]> {
    const params = search.trim() ? { search: search.trim() } : undefined;
    const res = await apiClient.get("/adminpanel/users/", { params });
    return unwrap<AdminUser[]>(res.data);
  },

  async moderateUser(userId: string, isBanned: boolean, banReason = ""): Promise<{ message: string; user: AdminUser }> {
    const res = await apiClient.post(`/adminpanel/users/${userId}/moderate/`, {
      is_banned: isBanned,
      ban_reason: banReason,
    });
    return { message: res.data?.message || "Updated.", user: res.data?.data };
  },

  // ── Abuse reports ─────────────────────────────────────────────────────────
  async getAbuseReports(resolved: boolean): Promise<AbuseReport[]> {
    const res = await apiClient.get("/adminpanel/abuse-reports/", { params: { is_resolved: resolved ? "true" : "false" } });
    return unwrap<AbuseReport[]>(res.data);
  },

  async resolveAbuseReport(reportId: string): Promise<string> {
    const res = await apiClient.post(`/adminpanel/abuse-reports/${reportId}/resolve/`);
    return res.data?.message || "Marked as resolved.";
  },

  // ── Invites ───────────────────────────────────────────────────────────────
  async getInvites(): Promise<AdminInvite[]> {
    const res = await apiClient.get("/adminpanel/invites/");
    return unwrap<AdminInvite[]>(res.data);
  },

  async createInvite(email: string): Promise<string> {
    const res = await apiClient.post("/adminpanel/invites/", { email: email.trim() });
    return res.data?.message || "Invitation sent.";
  },

  // ── Audit log, settings, feedback ─────────────────────────────────────────
  async getAuditLogs(postId?: string): Promise<AuditLogEntry[]> {
    const res = await apiClient.get("/adminpanel/audit-logs/", { params: postId ? { post_id: postId } : undefined });
    return unwrap<AuditLogEntry[]>(res.data);
  },

  async getSettings(): Promise<SiteSettings> {
    const res = await apiClient.get("/adminpanel/settings/");
    return unwrap<SiteSettings>(res.data);
  },

  async updateSettings(changes: Partial<SiteSettings>): Promise<{ message: string; settings: SiteSettings }> {
    const res = await apiClient.patch("/adminpanel/settings/", changes);
    return { message: res.data?.message || "Saved.", settings: unwrap<SiteSettings>(res.data) };
  },

  async getFeedback(): Promise<{ entries: FeedbackEntry[]; count: number; averageRating: number | null }> {
    const res = await apiClient.get("/feedback/");
    return {
      entries: res.data?.data || [],
      count: res.data?.summary?.count ?? 0,
      averageRating: res.data?.summary?.average_rating ?? null,
    };
  },

  // ── Matching (bare objects and DRF pages, not the {"success","data"} envelope) ──
  async getMatches(status: MatchStatus | "", page = 1): Promise<{ results: MatchListItem[]; hasNext: boolean; count: number }> {
    const params: Record<string, string | number> = { page };
    if (status) params.status = status;
    const res = await apiClient.get("/matching/", { params });
    return { results: res.data?.results || [], hasNext: Boolean(res.data?.next), count: res.data?.count ?? 0 };
  },

  async getMatch(matchId: string): Promise<MatchDetail> {
    const res = await apiClient.get(`/matching/${matchId}/`);
    return res.data;
  },

  async matchAction(matchId: string, action: "CONFIRM" | "DISMISS", notes = ""): Promise<MatchDetail> {
    const res = await apiClient.post(`/matching/${matchId}/action/`, { action, notes });
    return res.data?.match;
  },

  async recordProof(
    matchId: string,
    questions: ProofQuestion[],
    decision: "VERIFIED" | "KEEP_PENDING" | "REJECT",
    notes = ""
  ): Promise<{ message: string; match: MatchDetail }> {
    const res = await apiClient.post(`/matching/${matchId}/proof/`, { questions, decision, notes });
    return { message: res.data?.message || "Proof recorded.", match: res.data?.match };
  },

  async setMeetingMode(matchId: string, mode: "direct" | "office"): Promise<string> {
    const res = await apiClient.post(`/matching/${matchId}/meeting-mode/`, { meeting_mode: mode });
    return res.data?.message || "Meeting mode updated.";
  },

  /** The code is only ever returned here, once. */
  async generateHandoverCode(matchId: string): Promise<string> {
    const res = await apiClient.post(`/matching/${matchId}/handover-code/generate/`);
    return res.data?.code;
  },

  async verifyHandoverCode(matchId: string, code: string, notes = ""): Promise<{ message: string; match: MatchDetail }> {
    const res = await apiClient.post(`/matching/${matchId}/handover-code/verify/`, { code: code.trim(), notes });
    return { message: res.data?.message || "Handover verified.", match: res.data?.match };
  },

  async closeCase(matchId: string, reward: string, notes = ""): Promise<{ message: string; match: MatchDetail }> {
    const res = await apiClient.post(`/matching/${matchId}/close/`, {
      reward_amount_settled: reward.trim() || "0",
      notes,
    });
    return { message: res.data?.message || "Case closed.", match: res.data?.match };
  },

  async runMatching(): Promise<{ matches_created: number; matches_updated: number; scanned_pairs: number }> {
    const res = await apiClient.post("/matching/run/", {});
    return res.data?.data || { matches_created: 0, matches_updated: 0, scanned_pairs: 0 };
  },
};
