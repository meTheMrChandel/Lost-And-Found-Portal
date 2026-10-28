"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiClient, getErrorMessage, mediaUrl } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { Category, Post } from "@/types/post";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/Logo";

function FeedContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);

  // Filters
  const [selectedType, setSelectedType] = useState<string>(
    searchParams.get("type")?.toUpperCase() || "ALL"
  );
  const [selectedCategory, setSelectedCategory] = useState<string>(
    searchParams.get("category") || "ALL"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [ordering, setOrdering] = useState("-created_at");

  // Selected item modal
  const [activePost, setActivePost] = useState<Post | null>(null);

  // Abuse report modal
  const [reportingPost, setReportingPost] = useState<Post | null>(null);
  const [abuseReason, setAbuseReason] = useState<string>("spam");
  const [abuseDesc, setAbuseDesc] = useState("");
  const [abuseLoading, setAbuseLoading] = useState(false);
  const [abuseMsg, setAbuseMsg] = useState("");
  const [abuseError, setAbuseError] = useState("");

  const feedQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedType !== "ALL") params.append("post_type", selectedType);
    if (selectedCategory !== "ALL") params.append("category", selectedCategory);
    if (appliedSearch) params.append("search", appliedSearch);
    if (ordering) params.append("ordering", ordering);
    params.append("include_pending", "true");
    return params.toString();
  }, [selectedType, selectedCategory, appliedSearch, ordering]);

  const {
    data: feed,
    loading,
    error,
    refresh,
  } = useApiQuery<{ data?: Post[] }>(`/posts/feed/?${feedQuery}`, "Failed to load campus feed.");
  const posts = feed?.data ?? [];

  const applySearch = () => {
    setAppliedSearch(searchQuery.trim());
    refresh();
  };

  useEffect(() => {
    apiClient("/posts/categories/")
      .then((res) => {
        if (res?.data) {
          setCategories(res.data);
        }
      })
      .catch((err) => console.error("Failed to load categories", err));
  }, []);

  const handleReportAbuse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingPost) return;
    setAbuseLoading(true);
    setAbuseError("");
    setAbuseMsg("");

    try {
      const res = await apiClient(`/posts/${reportingPost.id}/report-abuse/`, {
        method: "POST",
        data: {
          reason: abuseReason,
          description: abuseDesc.trim(),
        },
      });
      setAbuseMsg(res.message || "Thank you for reporting. Admins will review this case.");
      setTimeout(() => {
        setReportingPost(null);
        setAbuseMsg("");
        setAbuseDesc("");
      }, 2000);
    } catch (err) {
      setAbuseError(getErrorMessage(err, "Failed to submit abuse report."));
    } finally {
      setAbuseLoading(false);
    }
  };

  const getCustodyLabel = (custody?: string) => {
    switch (custody) {
      case "finder":
        return "With Finder";
      case "admin_office":
        return "Admin Office Custody";
      case "security_office":
        return "Security Office Custody";
      default:
        return "Campus Custody";
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1C1E] flex flex-col justify-between">
      {/* Navigation Bar */}
      <header className="border-b border-[#EFEAE0] bg-[#FAF7F2]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={36} />
            <div>
              <span className="font-serif text-xl font-bold tracking-tight text-[#1C1C1E]">
                Campus Feed
              </span>
              <span className="text-[10px] text-[#6B7280] block font-sans tracking-wide">
                IIT ROPAR PORTAL
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/report/lost"
              className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-[#D94F3B] hover:opacity-95 shadow-sm transition-all"
            >
              + Report Lost
            </Link>
            <Link
              href="/report/found"
              className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-[#047857] hover:bg-[#10B981] shadow-sm transition-all"
            >
              + Report Found
            </Link>
            {user ? (
              <Link
                href="/my-reports"
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#1C1C1E] bg-[#EFEAE0] hover:bg-[#E2DDD2] transition-colors"
              >
                My Reports
              </Link>
            ) : (
              <Link
                href="/login?redirect=/feed"
                className="px-4 py-2 rounded-full text-xs font-semibold text-[#1C1C1E] bg-[#EFEAE0] hover:bg-[#E2DDD2] transition-colors"
              >
                Log In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Banner */}
        <div className="p-6 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
              Campus Belongings Directory
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              Browse approved items reported lost and found by students and staff across IIT Ropar.
            </p>
          </div>
          <div className="flex gap-2">
            {["ALL", "LOST", "FOUND"].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedType === type
                    ? type === "LOST"
                      ? "bg-[#D94F3B] text-white shadow-sm"
                      : type === "FOUND"
                      ? "bg-[#047857] text-white shadow-sm"
                      : "bg-[#1C1C1E] text-white shadow-sm"
                    : "bg-[#FAF7F2] text-[#6B7280] border border-[#E2DDD2] hover:text-[#1C1C1E]"
                }`}
              >
                {type === "ALL" ? "All Belongings" : `${type} Items`}
              </button>
            ))}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by keywords, location (e.g. library, hostel, cafeteria)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#E2DDD2] text-xs focus:ring-2 focus:ring-[#047857] outline-none shadow-sm"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={ordering}
              onChange={(e) => setOrdering(e.target.value)}
              className="px-4 py-2.5 rounded-2xl bg-white border border-[#E2DDD2] text-xs text-[#1C1C1E] outline-none shadow-sm cursor-pointer"
            >
              <option value="-created_at">Newest First</option>
              <option value="created_at">Oldest First</option>
              <option value="-reward_amount">Highest Reward</option>
            </select>

            <button
              onClick={applySearch}
              className="px-5 py-2.5 rounded-2xl bg-[#047857] hover:bg-[#10B981] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              Search
            </button>
          </div>
        </div>

        {/* Categories Horizontal Scroller */}
        <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3.5 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === "ALL"
                ? "bg-[#047857] text-white"
                : "bg-white text-[#6B7280] border border-[#E2DDD2] hover:text-[#1C1C1E]"
            }`}
          >
            All Categories
          </button>
          {categories
            .filter((c) => !c.is_sensitive)
            .map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setSelectedCategory(cat.slug)}
                className={`px-3.5 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.slug
                    ? "bg-[#047857] text-white"
                    : "bg-white text-[#6B7280] border border-[#E2DDD2] hover:text-[#1C1C1E]"
                }`}
              >
                {cat.name}
              </button>
            ))}
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Posts Grid */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[#6B7280]">
            Loading campus feed...
          </div>
        ) : posts.length === 0 ? (
          <div className="p-16 rounded-3xl bg-white border border-[#E2DDD2] text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#FAF7F2] text-xl flex items-center justify-center">
              🔍
            </div>
            <h3 className="font-serif text-xl font-bold text-[#1C1C1E]">
              No items found
            </h3>
            <p className="text-xs text-[#6B7280] max-w-sm">
              No reported belongings match your current search and filter settings.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => setActivePost(post)}
                className="bg-white rounded-3xl border border-[#E2DDD2] overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  {/* Photo or placeholder */}
                  <div className="w-full h-44 bg-[#FAF7F2] relative overflow-hidden flex items-center justify-center border-b border-[#EFEAE0]">
                    {post.images && post.images.length > 0 ? (
                      <img
                        src={mediaUrl(post.images[0].image)}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="text-3xl text-[#6B7280]/40 font-serif">
                        {post.post_type === "LOST" ? "❓" : "📦"}
                      </div>
                    )}

                    {/* Top tags */}
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white ${
                          post.post_type === "LOST" ? "bg-[#D94F3B]" : "bg-[#047857]"
                        }`}
                      >
                        {post.post_type}
                      </span>
                      {Number(post.reward_amount) > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F5B73B] text-[#1C1C1E]">
                          ₹{post.reward_amount} Reward
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-5 flex flex-col gap-2">
                    <span className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">
                      {post.category_name || post.category}
                    </span>

                    <h3 className="font-serif text-lg font-bold text-[#1C1C1E] group-hover:text-[#047857] transition-colors line-clamp-1">
                      {post.title}
                    </h3>

                    <p className="text-xs text-[#6B7280] line-clamp-2">
                      {post.description}
                    </p>

                    <div className="pt-2 text-xs text-[#6B7280] flex items-center gap-1 font-medium">
                      <span>📍</span>
                      <span className="truncate">{post.last_seen_place}</span>
                    </div>

                    {post.post_type === "FOUND" && post.custody_location && (
                      <span className="inline-block mt-1 self-start px-2 py-0.5 rounded-md bg-[#047857]/10 text-[#047857] text-[10px] font-semibold">
                        {getCustodyLabel(post.custody_location)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-[#EFEAE0] flex items-center justify-between text-[11px] text-[#6B7280]">
                  <span>
                    {new Date(post.created_at).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="font-bold text-[#047857] group-hover:translate-x-1 transition-transform">
                    View Details →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Item Detail Modal */}
      {activePost && (
        <div className="fixed inset-0 z-50 bg-[#1C1C1E]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#E2DDD2] flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white inline-block mb-1.5 ${
                    activePost.post_type === "LOST" ? "bg-[#D94F3B]" : "bg-[#047857]"
                  }`}
                >
                  {activePost.post_type} BELONGING
                </span>
                <h2 className="font-serif text-2xl font-bold text-[#1C1C1E]">
                  {activePost.title}
                </h2>
                <span className="text-[11px] text-[#6B7280] block">
                  Category: {activePost.category_name || activePost.category}
                </span>
              </div>
              <button
                onClick={() => setActivePost(null)}
                className="w-8 h-8 rounded-full bg-[#FAF7F2] hover:bg-[#EFEAE0] text-[#6B7280] flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Images */}
            {activePost.images && activePost.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto py-1">
                {activePost.images.map((img) => (
                  <img
                    key={img.id}
                    src={mediaUrl(img.image)}
                    alt=""
                    className="w-28 h-28 object-cover rounded-2xl border border-[#E2DDD2]"
                  />
                ))}
              </div>
            )}

            {/* Content */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-[#1C1C1E] uppercase text-[10px] block mb-1">
                  Description
                </span>
                <p className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#E2DDD2] text-[#1C1C1E] leading-relaxed">
                  {activePost.description}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#E2DDD2] flex flex-col gap-1.5">
                <div>
                  <span className="text-[#6B7280] font-semibold">Location: </span>
                  <span className="font-medium text-[#1C1C1E]">{activePost.last_seen_place}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] font-semibold">Date & Time: </span>
                  <span className="font-medium text-[#1C1C1E]">
                    {new Date(activePost.last_seen_time).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                {activePost.post_type === "FOUND" && activePost.custody_location && (
                  <div>
                    <span className="text-[#6B7280] font-semibold">Custody Location: </span>
                    <span className="font-bold text-[#047857]">
                      {getCustodyLabel(activePost.custody_location)}
                    </span>
                  </div>
                )}
                {Number(activePost.reward_amount) > 0 && (
                  <div>
                    <span className="text-[#6B7280] font-semibold">Promised Reward: </span>
                    <span className="font-bold text-[#047857]">₹{activePost.reward_amount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-[#EFEAE0] flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setReportingPost(activePost);
                  setActivePost(null);
                }}
                className="text-[11px] font-semibold text-[#D94F3B] hover:underline"
              >
                🚩 Report Abuse
              </button>

              <button
                onClick={() => setActivePost(null)}
                className="px-4 py-2 rounded-xl bg-[#1C1C1E] text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Abuse Modal */}
      {reportingPost && (
        <div className="fixed inset-0 z-50 bg-[#1C1C1E]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleReportAbuse}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#E2DDD2] flex flex-col gap-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-xl font-bold text-[#1C1C1E]">
                Report Post: {reportingPost.title}
              </h3>
              <button
                type="button"
                onClick={() => setReportingPost(null)}
                className="text-xs text-[#6B7280]"
              >
                ✕
              </button>
            </div>

            {abuseMsg && (
              <div className="p-3 rounded-xl bg-[#047857]/10 text-[#047857] text-xs font-semibold">
                {abuseMsg}
              </div>
            )}
            {abuseError && (
              <div className="p-3 rounded-xl bg-[#D94F3B]/10 text-[#D94F3B] text-xs font-semibold">
                {abuseError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-[#1C1C1E] mb-1">
                Reason for reporting
              </label>
              <select
                value={abuseReason}
                onChange={(e) => setAbuseReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs"
              >
                <option value="spam">Spam / Unrelated content</option>
                <option value="fake">Fake or misleading information</option>
                <option value="inappropriate">Inappropriate / abusive language</option>
                <option value="other">Other policy violation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#1C1C1E] mb-1">
                Optional comments
              </label>
              <textarea
                rows={3}
                placeholder="Briefly describe the issue for the campus admins..."
                value={abuseDesc}
                onChange={(e) => setAbuseDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReportingPost(null)}
                className="px-4 py-2 text-xs text-[#6B7280]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={abuseLoading}
                className="px-5 py-2 rounded-xl bg-[#D94F3B] hover:opacity-95 text-white text-xs font-bold disabled:opacity-50"
              >
                {abuseLoading ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#EFEAE0] bg-[#FAF7F2] mt-12">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#6B7280] gap-4">
          <p>© 2026 IIT Ropar Lost & Found Portal. CS509 PG Software Lab.</p>
          <div className="flex gap-6">
            <span>Admin Supervision</span>
            <span>Zero-Knowledge Scans</span>
            <span>Secured Verification</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-xs text-[#6B7280]">
          Loading campus feed...
        </div>
      }
    >
      <FeedContent />
    </Suspense>
  );
}
