"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  icon?: string;
  is_sensitive?: boolean;
}

interface AuthorSummary {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  registration_number?: string;
}

interface PostSummary {
  id: string;
  title: string;
  description: string;
  post_type: "LOST" | "FOUND";
  status: string;
  category: CategorySummary;
  last_seen_place: string;
  last_seen_time: string;
  location?: string;
  date_lost_or_found?: string;
  reward_amount?: string | number;
  custody_location?: string;
  custody?: string;
  inform_admin_privately?: boolean;
  author?: AuthorSummary;
  images: string[];
  hidden_proof?: string;
  created_at: string;
}

interface MatchItem {
  id: string;
  score: number;
  status: "suggested" | "confirmed" | "proof_pending" | "verified" | "handed_over" | "closed" | "dismissed";
  meeting_mode?: string;
  lost_post: PostSummary;
  found_post: PostSummary;
  created_at: string;
  updated_at: string;
}

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [runningEngine, setRunningEngine] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("suggested");
  const [searchQuery, setSearchQuery] = useState("");
  const [minScore, setMinScore] = useState<number>(0.75);

  // Action dialog
  const [activeMatch, setActiveMatch] = useState<MatchItem | null>(null);
  const [actionType, setActionType] = useState<"CONFIRM" | "DISMISS" | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchMatches = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") params.append("status", statusFilter);
      if (minScore > 0) params.append("min_score", minScore.toString());
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await apiClient(`/matching/?${params.toString()}`);
      if (res?.data) {
        setMatches(Array.isArray(res.data) ? res.data : res.data.results || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load matching queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [statusFilter, minScore]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMatches();
  };

  const handleTriggerEngine = async () => {
    setRunningEngine(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await apiClient("/matching/run/", { method: "POST" });
      const data = res?.data || {};
      setSuccessMsg(
        `Engine finished! Scanned: ${data.scanned_pairs || 0} pairs, Created: ${
          data.matches_created || 0
        } new match(es), Updated: ${data.matches_updated || 0}.`
      );
      await fetchMatches();
    } catch (err: any) {
      setError(err.message || "Failed to execute matching engine.");
    } finally {
      setRunningEngine(false);
    }
  };

  const submitMatchAction = async () => {
    if (!activeMatch || !actionType) return;
    setSubmittingAction(true);
    setError("");
    try {
      await apiClient(`/matching/${activeMatch.id}/action/`, {
        method: "POST",
        body: JSON.stringify({
          action: actionType,
          notes: actionNotes.trim(),
        }),
      });

      setSuccessMsg(
        `Match ${activeMatch.id.slice(0, 8)} successfully ${
          actionType === "CONFIRM" ? "confirmed" : "dismissed"
        }.`
      );
      setActiveMatch(null);
      setActionType(null);
      setActionNotes("");
      await fetchMatches();
    } catch (err: any) {
      setError(err.message || "Failed to process match action.");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Quick stats
  const totalSuggested = matches.filter((m) => m.status === "suggested").length;
  const totalConfirmed = matches.filter((m) => m.status === "confirmed").length;

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#EFEAE0] shadow-sm">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1C1C1E]">
            Automated Match Queue
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Algorithmic candidate pairing between Lost and Found posts using category, date window, campus location, and description text similarity.
          </p>
        </div>

        <button
          onClick={handleTriggerEngine}
          disabled={runningEngine}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#047857] text-white text-xs font-bold hover:bg-[#065F46] disabled:opacity-50 transition shadow-sm"
        >
          {runningEngine ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Scanning Catalog...</span>
            </>
          ) : (
            <>
              <span>⚡ Run Matching Engine Now</span>
            </>
          )}
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="font-bold ml-2">✕</button>
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-[#EFEAE0] space-y-4 shadow-sm">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#EFEAE0]/80 pb-3">
          {[
            { id: "suggested", label: "Suggested" },
            { id: "confirmed", label: "Confirmed" },
            { id: "proof_pending", label: "Proof Pending" },
            { id: "verified", label: "Verified" },
            { id: "handed_over", label: "Handed Over" },
            { id: "dismissed", label: "Dismissed" },
            { id: "ALL", label: "All Matches" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === tab.id
                  ? "bg-[#047857] text-white shadow-sm"
                  : "bg-[#FAF7F2] text-[#6B7280] hover:text-[#1C1C1E] border border-[#EFEAE0]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Score threshold */}
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[240px]">
            <input
              type="text"
              placeholder="Search by title, keywords or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFEAE0] text-xs focus:outline-none focus:ring-2 focus:ring-[#047857]"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#6B7280]">Min Confidence:</label>
            <select
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFEAE0] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#047857]"
            >
              <option value="0.90">≥ 90% (Very High)</option>
              <option value="0.80">≥ 80% (High)</option>
              <option value="0.75">≥ 75% (Threshold)</option>
              <option value="0.60">≥ 60% (Moderate)</option>
              <option value="0.0">All Scores (0%)</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-[#FAF7F2] hover:bg-[#EFEAE0] border border-[#EFEAE0] text-xs font-bold rounded-xl transition"
          >
            Apply Filters
          </button>
        </form>
      </div>

      {/* Matches Listing */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#6B7280]">
          Loading match queue...
        </div>
      ) : matches.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-[#EFEAE0]">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="font-serif text-lg font-bold text-[#1C1C1E]">
            No matching pairs found
          </h3>
          <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
            No items match the selected status or threshold. Click &quot;Run Matching Engine Now&quot; to scan for fresh candidate pairs.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((item) => {
            const scorePercent = Math.round(item.score * 100);
            const isHigh = scorePercent >= 85;
            const isMedium = scorePercent >= 75 && scorePercent < 85;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-[#EFEAE0] overflow-hidden shadow-sm hover:border-[#047857]/30 transition"
              >
                {/* Match Bar Header */}
                <div className="px-6 py-3.5 bg-[#FAF7F2] border-b border-[#EFEAE0] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase ${
                        isHigh
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : isMedium
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {scorePercent}% Match Confidence
                    </span>

                    <span className="text-xs font-mono text-[#6B7280]">
                      Match ID: {item.id.slice(0, 8)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                        item.status === "confirmed"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : item.status === "dismissed"
                          ? "bg-gray-100 text-gray-500"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {item.status.replace("_", " ")}
                    </span>

                    {/* Admin Actions */}
                    {item.status === "suggested" && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setActiveMatch(item);
                            setActionType("CONFIRM");
                            setActionNotes("");
                          }}
                          className="px-3 py-1 bg-[#047857] hover:bg-[#065F46] text-white text-xs font-bold rounded-lg shadow-sm transition"
                        >
                          Confirm Match
                        </button>
                        <button
                          onClick={() => {
                            setActiveMatch(item);
                            setActionType("DISMISS");
                            setActionNotes("");
                          }}
                          className="px-3 py-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-[#EFEAE0]">
                  {/* Lost Item Side */}
                  <div className="space-y-3 md:pr-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-800">
                        LOST ITEM
                      </span>
                      <span className="text-xs font-semibold text-[#6B7280]">
                        {item.lost_post.category?.name || "Belonging"}
                      </span>
                    </div>

                    <h4 className="font-serif text-lg font-bold text-[#1C1C1E]">
                      {item.lost_post.title}
                    </h4>

                    <p className="text-xs text-[#4B5563] line-clamp-2">
                      {item.lost_post.description}
                    </p>

                    <div className="space-y-1.5 text-xs text-[#6B7280] bg-[#FAF7F2] p-3 rounded-xl border border-[#EFEAE0]">
                      <div className="flex items-center justify-between">
                        <span>📍 Lost Place:</span>
                        <strong className="text-[#1C1C1E]">{item.lost_post.last_seen_place}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>🕒 Lost Time:</span>
                        <strong className="text-[#1C1C1E]">
                          {item.lost_post.last_seen_time
                            ? new Date(item.lost_post.last_seen_time).toLocaleDateString()
                            : "N/A"}
                        </strong>
                      </div>
                      {item.lost_post.author && (
                        <div className="flex items-center justify-between">
                          <span>👤 Student:</span>
                          <span className="text-[#1C1C1E] font-medium">
                            {item.lost_post.author.full_name} ({item.lost_post.author.registration_number || item.lost_post.author.email})
                          </span>
                        </div>
                      )}
                      {Number(item.lost_post.reward_amount || 0) > 0 && (
                        <div className="flex items-center justify-between text-amber-700">
                          <span>🎁 Reward:</span>
                          <strong>₹{item.lost_post.reward_amount}</strong>
                        </div>
                      )}
                    </div>

                    {/* Hidden Proof indicator for admin */}
                    {item.lost_post.hidden_proof && (
                      <div className="p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-900">
                        <span className="font-bold text-[10px] uppercase block mb-0.5 text-amber-800">
                          🔒 Confidential Proof On File:
                        </span>
                        <span className="italic">{item.lost_post.hidden_proof}</span>
                      </div>
                    )}
                  </div>

                  {/* Found Item Side */}
                  <div className="space-y-3 pt-4 md:pt-0 md:pl-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        FOUND ITEM
                      </span>
                      <span className="text-xs font-semibold text-[#6B7280]">
                        {item.found_post.category?.name || "Belonging"}
                      </span>
                    </div>

                    <h4 className="font-serif text-lg font-bold text-[#1C1C1E]">
                      {item.found_post.title}
                    </h4>

                    <p className="text-xs text-[#4B5563] line-clamp-2">
                      {item.found_post.description}
                    </p>

                    <div className="space-y-1.5 text-xs text-[#6B7280] bg-[#FAF7F2] p-3 rounded-xl border border-[#EFEAE0]">
                      <div className="flex items-center justify-between">
                        <span>📍 Found Place:</span>
                        <strong className="text-[#1C1C1E]">{item.found_post.last_seen_place}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>🕒 Found Time:</span>
                        <strong className="text-[#1C1C1E]">
                          {item.found_post.last_seen_time
                            ? new Date(item.found_post.last_seen_time).toLocaleDateString()
                            : "N/A"}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>🏛️ Custody:</span>
                        <span className="text-[#047857] font-bold capitalize">
                          {(item.found_post.custody_location || item.found_post.custody || "finder").replace("_", " ")}
                        </span>
                      </div>
                      {item.found_post.author && (
                        <div className="flex items-center justify-between">
                          <span>👤 Finder:</span>
                          <span className="text-[#1C1C1E] font-medium">
                            {item.found_post.author.full_name} ({item.found_post.author.email})
                          </span>
                        </div>
                      )}
                    </div>

                    {item.found_post.inform_admin_privately && (
                      <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                        🔒 Finder requested private admin disclosure only.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Action Modal */}
      {activeMatch && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-[#EFEAE0] max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#1C1C1E]">
              {actionType === "CONFIRM" ? "Confirm Match Suggestion" : "Dismiss Match"}
            </h3>
            <p className="text-xs text-[#6B7280]">
              {actionType === "CONFIRM"
                ? "Confirming links these two cases for admin proof verification and notification to the owner and finder."
                : "Dismissing marks this pair as incompatible and removes it from the active match queue."}
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#1C1C1E] mb-1">
                Admin Notes (Optional):
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="e.g. Visual match confirmed, exact model and location overlap."
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFEAE0] text-xs focus:outline-none focus:ring-2 focus:ring-[#047857]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setActiveMatch(null);
                  setActionType(null);
                }}
                disabled={submittingAction}
                className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#1C1C1E]"
              >
                Cancel
              </button>
              <button
                onClick={submitMatchAction}
                disabled={submittingAction}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition ${
                  actionType === "CONFIRM"
                    ? "bg-[#047857] hover:bg-[#065F46]"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {submittingAction
                  ? "Processing..."
                  : actionType === "CONFIRM"
                  ? "Confirm Match"
                  : "Dismiss Match"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
