"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Category, Post, PostStatus } from "@/types/post";

export default function AdminCaseQueuePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [slaBreachedOnly, setSlaBreachedOnly] = useState(false);

  // Review modal
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Review inputs
  const [reviewAction, setReviewAction] = useState<string | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [newCategorySlug, setNewCategorySlug] = useState("");

  const fetchCategories = async () => {
    try {
      const res = await apiClient("/posts/categories/");
      if (res?.data) {
        setCategories(res.data);
      }
    } catch (err) {
      console.error("Failed to load categories", err);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") params.append("status", statusFilter);
      if (categoryFilter) params.append("category", categoryFilter);
      if (typeFilter) params.append("post_type", typeFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      if (slaBreachedOnly) params.append("sla_breached", "true");

      const endpoint = `/adminpanel/posts/?${params.toString()}`;
      const res = await apiClient(endpoint);
      if (res?.data) {
        setPosts(res.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load case queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [statusFilter, categoryFilter, typeFilter, slaBreachedOnly]);

  const openCaseDetail = async (postId: string) => {
    setReviewAction(null);
    setReviewRemarks("");
    try {
      const res = await apiClient(`/adminpanel/posts/${postId}/`);
      if (res?.data) {
        setSelectedPost(res.data);
        setNewCategorySlug(res.data.category);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load case details.");
    }
  };

  const executeReviewAction = async (action: string) => {
    if (!selectedPost) return;

    if ((action === "REJECT" || action === "INFO_REQUESTED") && !reviewRemarks.trim()) {
      alert(`Please enter a remark explaining why you are choosing '${action}'.`);
      return;
    }

    if (action === "CHANGE_CATEGORY" && (!newCategorySlug || newCategorySlug === selectedPost.category)) {
      alert("Please select a new category to apply.");
      return;
    }

    setActionLoading(true);
    setError("");
    try {
      const payload: Record<string, any> = {
        action,
        remarks: reviewRemarks.trim(),
      };
      if (action === "CHANGE_CATEGORY") {
        payload.new_category = newCategorySlug;
      }

      const res = await apiClient(`/adminpanel/posts/${selectedPost.id}/review/`, {
        method: "POST",
        data: payload,
      });

      setSuccessMsg(res.message || `Case ${action} action executed successfully.`);
      setSelectedPost(null);
      setReviewAction(null);
      setReviewRemarks("");
      fetchPosts();
    } catch (err: any) {
      setError(err.message || "Review action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: PostStatus, isSlaBreached?: boolean) => {
    let badgeClass = "bg-[#EFEAE0] text-[#1C1C1E]";
    let label: string = status;

    if (status === "PENDING") {
      badgeClass = isSlaBreached
        ? "bg-[#D94F3B] text-white animate-pulse"
        : "bg-[#F5B73B]/20 text-[#B45309]";
      label = isSlaBreached ? "⚠️ SLA BREACHED (24h+)" : "PENDING REVIEW";
    } else if (status === "APPROVED") {
      badgeClass = "bg-[#047857]/15 text-[#047857]";
      label = "APPROVED / LIVE";
    } else if (status === "INFO_REQUESTED") {
      badgeClass = "bg-blue-100 text-blue-700";
      label = "MORE INFO REQUESTED";
    } else if (status === "RETURNED") {
      badgeClass = "bg-[#047857] text-white";
      label = "RETURNED TO OWNER";
    } else if (status === "REJECTED") {
      badgeClass = "bg-[#D94F3B]/15 text-[#D94F3B]";
      label = "REJECTED";
    } else if (status === "HIDDEN") {
      badgeClass = "bg-gray-200 text-gray-700";
      label = "HIDDEN";
    }

    return (
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${badgeClass}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
            Case Review Queue
          </h1>
          <p className="text-sm text-[#6B7280]">
            Review incoming lost and found reports, verify hidden ownership proofs, and manage publication.
          </p>
        </div>
        <button
          onClick={fetchPosts}
          disabled={loading}
          className="self-start md:self-auto px-4 py-2 rounded-xl bg-white border border-[#E2DDD2] hover:bg-[#FAF7F2] text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          {loading ? "Refreshing..." : "↻ Refresh Queue"}
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-[#047857]/10 border border-[#047857]/20 text-[#047857] text-xs font-semibold">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-[#E2DDD2] shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by title, location, student name, email, or reg #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchPosts()}
            className="w-full px-4 py-2 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs focus:ring-2 focus:ring-[#047857] outline-none"
          />
        </div>

        {/* Category Dropdown */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs text-[#1C1C1E] outline-none cursor-pointer"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name} {c.is_sensitive ? "[Sensitive]" : ""}
            </option>
          ))}
        </select>

        {/* Type Dropdown */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs text-[#1C1C1E] outline-none cursor-pointer"
        >
          <option value="">All Types (Lost/Found)</option>
          <option value="LOST">Lost Posts Only</option>
          <option value="FOUND">Found Posts Only</option>
        </select>

        {/* SLA Warning Filter */}
        <button
          onClick={() => setSlaBreachedOnly(!slaBreachedOnly)}
          className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            slaBreachedOnly
              ? "bg-[#D94F3B] text-white border-[#D94F3B]"
              : "bg-[#FAF7F2] text-[#6B7280] border-[#E2DDD2] hover:text-[#1C1C1E]"
          }`}
        >
          ⚠️ SLA Overdue
        </button>

        <button
          onClick={fetchPosts}
          className="px-4 py-2 rounded-xl bg-[#1C1C1E] hover:bg-black text-white text-xs font-bold transition-all cursor-pointer"
        >
          Filter
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 border-b border-[#EFEAE0]">
        {[
          { key: "ALL", label: "All Cases" },
          { key: "PENDING", label: "Pending Review" },
          { key: "APPROVED", label: "Approved / Live" },
          { key: "INFO_REQUESTED", label: "Info Needed" },
          { key: "RETURNED", label: "Returned" },
          { key: "REJECTED", label: "Rejected" },
          { key: "HIDDEN", label: "Hidden" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === tab.key
                ? "bg-[#047857] text-white shadow-sm"
                : "bg-white text-[#6B7280] hover:text-[#1C1C1E] border border-[#E2DDD2]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Case List Table */}
      <div className="p-6 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm">
        {loading ? (
          <p className="text-xs text-[#6B7280] py-8 text-center">Loading case queue...</p>
        ) : posts.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#6B7280]">
            No cases match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EFEAE0] text-[#6B7280] font-semibold uppercase">
                <tr>
                  <th className="pb-3 px-2">Type</th>
                  <th className="pb-3 px-2">Item Name & Category</th>
                  <th className="pb-3 px-2">Author Student</th>
                  <th className="pb-3 px-2">Last Seen Location</th>
                  <th className="pb-3 px-2">Status</th>
                  <th className="pb-3 px-2">Reported Date</th>
                  <th className="pb-3 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]/60">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                    <td className="py-3.5 px-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          post.post_type === "LOST"
                            ? "bg-[#D94F3B]/10 text-[#D94F3B]"
                            : "bg-[#047857]/10 text-[#047857]"
                        }`}
                      >
                        {post.post_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-2 font-medium text-[#1C1C1E]">
                      <div className="flex items-center gap-2">
                        {post.images && post.images.length > 0 && (
                          <img
                            src={post.images[0].image}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover border border-[#E2DDD2]"
                          />
                        )}
                        <div>
                          <span className="font-bold block">{post.title}</span>
                          <span className="text-[10px] text-[#6B7280] uppercase tracking-wider">
                            {post.category_name || post.category}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-2 text-[#6B7280]">
                      <div className="font-medium text-[#1C1C1E]">{post.author_name}</div>
                      <div className="font-mono text-[10px]">{post.author_registration_number}</div>
                    </td>
                    <td className="py-3.5 px-2 text-[#6B7280] max-w-xs truncate">
                      {post.last_seen_place}
                    </td>
                    <td className="py-3.5 px-2">
                      {getStatusBadge(post.status, post.is_sla_breached)}
                    </td>
                    <td className="py-3.5 px-2 text-[#6B7280] whitespace-nowrap text-[11px] font-mono">
                      {new Date(post.created_at).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-2 text-right">
                      <button
                        onClick={() => openCaseDetail(post.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#EFEAE0] border border-[#E2DDD2] text-[11px] font-bold text-[#1C1C1E] transition-all cursor-pointer"
                      >
                        Review Case →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Case Review Modal Drawer */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-[#1C1C1E]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-[#E2DDD2] flex flex-col gap-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#EFEAE0] pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedPost.post_type === "LOST"
                        ? "bg-[#D94F3B]/10 text-[#D94F3B]"
                        : "bg-[#047857]/10 text-[#047857]"
                    }`}
                  >
                    {selectedPost.post_type} CASE
                  </span>
                  {getStatusBadge(selectedPost.status)}
                </div>
                <h2 className="font-serif text-2xl font-bold text-[#1C1C1E]">
                  {selectedPost.title}
                </h2>
                <span className="text-[10px] text-[#6B7280] font-mono">
                  Case ID: #{selectedPost.id}
                </span>
              </div>
              <button
                onClick={() => setSelectedPost(null)}
                className="w-8 h-8 rounded-full bg-[#FAF7F2] hover:bg-[#EFEAE0] text-[#6B7280] flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Author Student Card */}
            {selectedPost.author && (
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E2DDD2] flex flex-col sm:flex-row justify-between gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-[#6B7280] font-bold uppercase block">
                    Author Student Record
                  </span>
                  <div className="font-bold text-[#1C1C1E] text-sm">
                    {selectedPost.author.full_name}
                  </div>
                  <div className="text-[#6B7280]">
                    {selectedPost.author.email} • Reg: {selectedPost.author.registration_number}
                  </div>
                  <div className="text-[#6B7280]">
                    Dept: {selectedPost.author.department} ({selectedPost.author.program_year})
                  </div>
                </div>
                <div className="flex flex-col items-start sm:items-end justify-between">
                  {selectedPost.author.phone && (
                    <span className="text-[#6B7280]">📞 {selectedPost.author.phone}</span>
                  )}
                  {selectedPost.author.is_banned ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D94F3B] text-white">
                      SUSPENDED USER
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#047857]/10 text-[#047857]">
                      ACTIVE STUDENT
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Photos */}
            {selectedPost.images && selectedPost.images.length > 0 && (
              <div>
                <span className="text-xs font-bold uppercase text-[#1C1C1E] block mb-2">
                  Uploaded Evidence Photos ({selectedPost.images.length})
                </span>
                <div className="flex gap-3 overflow-x-auto py-1">
                  {selectedPost.images.map((img) => (
                    <a
                      key={img.id}
                      href={img.image}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative w-28 h-28 rounded-2xl overflow-hidden border border-[#E2DDD2] flex-shrink-0"
                    >
                      <img
                        src={img.image}
                        alt="evidence"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] bg-black/60 text-white font-mono">
                        Zoom 🔍
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Content & Details */}
            <div className="flex flex-col gap-3 text-xs">
              <div>
                <span className="font-bold text-[#1C1C1E] uppercase text-[11px] block">
                  Public Description
                </span>
                <p className="text-[#6B7280] mt-1 bg-[#FAF7F2] p-3 rounded-xl border border-[#E2DDD2] whitespace-pre-wrap">
                  {selectedPost.description || "No description provided."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2]">
                  <span className="text-[10px] font-bold uppercase text-[#6B7280] block">
                    Last Seen Location
                  </span>
                  <span className="font-medium text-[#1C1C1E]">{selectedPost.last_seen_place}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2]">
                  <span className="text-[10px] font-bold uppercase text-[#6B7280] block">
                    Last Seen Date/Time
                  </span>
                  <span className="font-medium text-[#1C1C1E]">
                    {new Date(selectedPost.last_seen_time).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Confidential Ownership Proof (Crucial Staff Review Panel) */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">🔒</span>
                <span className="text-xs font-bold uppercase text-[#B45309]">
                  Secret Ownership Proof (Confidential — Never Shown Publicly)
                </span>
              </div>
              <p className="text-xs text-[#1C1C1E] font-medium leading-relaxed bg-white/80 p-3 rounded-xl border border-amber-500/20">
                {selectedPost.hidden_proof || (
                  <span className="italic text-[#6B7280]">
                    No secret proof was provided by the student.
                  </span>
                )}
              </p>
            </div>

            {/* Audit History Timeline */}
            {selectedPost.audit_history && selectedPost.audit_history.length > 0 && (
              <div>
                <span className="text-xs font-bold uppercase text-[#1C1C1E] block mb-2">
                  Moderation Audit History
                </span>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {selectedPost.audit_history.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFEAE0] text-[11px] flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-[#047857] uppercase mr-2">
                          {log.action}
                        </span>
                        <span className="text-[#6B7280]">by {log.admin_email}</span>
                        {log.notes && <div className="text-[#1C1C1E] mt-0.5">"{log.notes}"</div>}
                      </div>
                      <span className="text-[10px] text-[#6B7280] font-mono">
                        {new Date(log.created_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Review Action Box */}
            <div className="p-4 rounded-2xl bg-white border-2 border-[#1C1C1E]/20 flex flex-col gap-4">
              <span className="text-xs font-bold uppercase text-[#1C1C1E]">
                Staff Moderation Decisions
              </span>

              {/* Sub-action forms */}
              {reviewAction === "REJECT" && (
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold text-[#D94F3B]">
                    Reason for Rejection (Visible to student):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inappropriate item description / Duplicate report"
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs outline-none focus:ring-2 focus:ring-[#D94F3B]"
                  />
                  <div className="flex justify-end gap-2 mt-1">
                    <button
                      onClick={() => setReviewAction(null)}
                      className="px-3 py-1.5 text-xs text-[#6B7280]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => executeReviewAction("REJECT")}
                      disabled={actionLoading || !reviewRemarks.trim()}
                      className="px-4 py-1.5 rounded-xl bg-[#D94F3B] text-white text-xs font-bold disabled:opacity-50"
                    >
                      {actionLoading ? "Submitting..." : "Confirm Rejection"}
                    </button>
                  </div>
                </div>
              )}

              {reviewAction === "INFO_REQUESTED" && (
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold text-blue-700">
                    What additional details are needed from the student?
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Please upload photo of backside or mention phone model"
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <div className="flex justify-end gap-2 mt-1">
                    <button
                      onClick={() => setReviewAction(null)}
                      className="px-3 py-1.5 text-xs text-[#6B7280]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => executeReviewAction("INFO_REQUESTED")}
                      disabled={actionLoading || !reviewRemarks.trim()}
                      className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {actionLoading ? "Submitting..." : "Send Info Request"}
                    </button>
                  </div>
                </div>
              )}

              {reviewAction === "CHANGE_CATEGORY" && (
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold text-[#1C1C1E]">
                    Select New Category:
                  </label>
                  <select
                    value={newCategorySlug}
                    onChange={(e) => setNewCategorySlug(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Optional note for changing category..."
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs outline-none"
                  />
                  <div className="flex justify-end gap-2 mt-1">
                    <button
                      onClick={() => setReviewAction(null)}
                      className="px-3 py-1.5 text-xs text-[#6B7280]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => executeReviewAction("CHANGE_CATEGORY")}
                      disabled={actionLoading}
                      className="px-4 py-1.5 rounded-xl bg-[#1C1C1E] text-white text-xs font-bold"
                    >
                      {actionLoading ? "Saving..." : "Apply Category Change"}
                    </button>
                  </div>
                </div>
              )}

              {/* Main Button Row */}
              {!reviewAction && (
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => executeReviewAction("APPROVE")}
                    disabled={actionLoading}
                    className="px-5 py-2.5 rounded-xl bg-[#047857] hover:bg-[#10B981] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    {actionLoading ? "Processing..." : "✓ Approve & Publish to Feed"}
                  </button>

                  <button
                    onClick={() => setReviewAction("REJECT")}
                    disabled={actionLoading}
                    className="px-4 py-2.5 rounded-xl bg-[#D94F3B]/10 hover:bg-[#D94F3B]/20 text-[#D94F3B] text-xs font-bold border border-[#D94F3B]/20 transition-all cursor-pointer"
                  >
                    ✕ Reject...
                  </button>

                  <button
                    onClick={() => setReviewAction("INFO_REQUESTED")}
                    disabled={actionLoading}
                    className="px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition-all cursor-pointer"
                  >
                    ℹ Request Info...
                  </button>

                  <button
                    onClick={() => setReviewAction("CHANGE_CATEGORY")}
                    disabled={actionLoading}
                    className="px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#EFEAE0] text-[#1C1C1E] text-xs font-semibold border border-[#E2DDD2] transition-all cursor-pointer"
                  >
                    Edit Category
                  </button>

                  {selectedPost.status === "APPROVED" && (
                    <button
                      onClick={() => executeReviewAction("HIDE")}
                      disabled={actionLoading}
                      className="px-3.5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold border border-gray-300 transition-all cursor-pointer ml-auto"
                    >
                      Hide from Feed
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
