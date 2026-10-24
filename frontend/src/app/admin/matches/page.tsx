"use client";

import { useEffect, useState } from "react";
import { apiClient, getErrorMessage } from "@/lib/api";

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

interface ProofQuestion {
  question: string;
  answer: string;
  is_correct?: boolean;
}

interface MatchItem {
  id: string;
  score: number;
  status: "suggested" | "confirmed" | "proof_pending" | "verified" | "handed_over" | "closed" | "dismissed";
  meeting_mode?: string;
  proof_questions?: ProofQuestion[];
  proof_verified_at?: string;
  handover_code_used?: boolean;
  handed_over_at?: string;
  reward_amount_settled?: string | number;
  reward_settled_at?: string;
  admin_notes?: string;
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

  // Action dialog (Confirm / Dismiss)
  const [activeMatch, setActiveMatch] = useState<MatchItem | null>(null);
  const [actionType, setActionType] = useState<"CONFIRM" | "DISMISS" | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  // Phase 6: Proof Q&A Modal
  const [proofModalMatch, setProofModalMatch] = useState<MatchItem | null>(null);
  const [proofQuestionsList, setProofQuestionsList] = useState<ProofQuestion[]>([
    { question: "", answer: "", is_correct: true },
  ]);
  const [proofDecision, setProofDecision] = useState<"VERIFIED" | "KEEP_PENDING" | "REJECT">("VERIFIED");
  const [proofNotes, setProofNotes] = useState("");

  // Phase 6: Handover Code Dialog
  const [handoverModalMatch, setHandoverModalMatch] = useState<MatchItem | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [verifyCodeInput, setVerifyCodeInput] = useState("");

  // Phase 6: Close Case & Settle Reward Modal
  const [closeModalMatch, setCloseModalMatch] = useState<MatchItem | null>(null);
  const [settledReward, setSettledReward] = useState<string>("0");
  const [closeNotes, setCloseNotes] = useState("");

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
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load matching queue."));
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
    } catch (err) {
      setError(getErrorMessage(err, "Failed to execute matching engine."));
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
    } catch (err) {
      setError(getErrorMessage(err, "Failed to process match action."));
    } finally {
      setSubmittingAction(false);
    }
  };

  // Phase 6: Submit Proof Q&A
  const handleOpenProofModal = (item: MatchItem) => {
    setProofModalMatch(item);
    setProofNotes("");
    if (item.proof_questions && item.proof_questions.length > 0) {
      setProofQuestionsList(item.proof_questions);
    } else {
      setProofQuestionsList([
        {
          question: "Can you confirm distinguishing marks or lockscreen wallpaper?",
          answer: "",
          is_correct: true,
        },
        {
          question: "Can you provide the serial number or receipt proof?",
          answer: "",
          is_correct: true,
        },
      ]);
    }
  };

  const handleSubmitProof = async () => {
    if (!proofModalMatch) return;
    setSubmittingAction(true);
    setError("");
    try {
      await apiClient(`/matching/${proofModalMatch.id}/proof/`, {
        method: "POST",
        body: JSON.stringify({
          questions: proofQuestionsList.filter((q) => q.question.trim()),
          decision: proofDecision,
          notes: proofNotes.trim(),
        }),
      });

      setSuccessMsg(`Proof evaluation recorded. Match is now ${proofDecision.toLowerCase().replace("_", " ")}.`);
      setProofModalMatch(null);
      await fetchMatches();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to submit proof evaluation."));
    } finally {
      setSubmittingAction(false);
    }
  };

  // Phase 6: Meeting Mode selection
  const handleSetMeetingMode = async (matchId: string, mode: "direct" | "office") => {
    try {
      await apiClient(`/matching/${matchId}/meeting-mode/`, {
        method: "POST",
        body: JSON.stringify({ meeting_mode: mode }),
      });
      setSuccessMsg(`Meeting mode updated to: ${mode === "office" ? "Admin / Security Office" : "Direct Meet"}`);
      await fetchMatches();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to set meeting mode."));
    }
  };

  // Phase 6: Generate Handover Code
  const handleGenerateCode = async (matchId: string) => {
    setSubmittingAction(true);
    setError("");
    try {
      const res = await apiClient(`/matching/${matchId}/handover-code/generate/`, { method: "POST" });
      if (res?.data?.code) {
        setGeneratedCode(res.data.code);
        setSuccessMsg(`Handover code generated: ${res.data.code}`);
      }
      await fetchMatches();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to generate handover code."));
    } finally {
      setSubmittingAction(false);
    }
  };

  // Phase 6: Verify Handover Code
  const handleVerifyCode = async () => {
    if (!handoverModalMatch || !verifyCodeInput.trim()) return;
    setSubmittingAction(true);
    setError("");
    try {
      await apiClient(`/matching/${handoverModalMatch.id}/handover-code/verify/`, {
        method: "POST",
        body: JSON.stringify({ code: verifyCodeInput.trim() }),
      });
      setSuccessMsg("Handover verified successfully! Item marked Handed Over.");
      setHandoverModalMatch(null);
      setVerifyCodeInput("");
      setGeneratedCode(null);
      await fetchMatches();
    } catch (err) {
      setError(getErrorMessage(err, "Invalid handover verification code."));
    } finally {
      setSubmittingAction(false);
    }
  };

  // Phase 6: Close Case & Settle Reward
  const handleCloseCase = async () => {
    if (!closeModalMatch) return;
    setSubmittingAction(true);
    setError("");
    try {
      await apiClient(`/matching/${closeModalMatch.id}/close/`, {
        method: "POST",
        body: JSON.stringify({
          reward_amount_settled: parseFloat(settledReward) || 0.0,
          notes: closeNotes.trim(),
        }),
      });
      setSuccessMsg("Case officially closed! Reward settled and posts marked Returned.");
      setCloseModalMatch(null);
      setSettledReward("0");
      setCloseNotes("");
      await fetchMatches();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to close case."));
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#EFEAE0] shadow-sm">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1C1C1E]">
            Automated Match & Verification Queue
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Algorithmic candidate pairing, hidden-proof Q&A verification, single-use handover codes, and reward settlements.
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
            { id: "closed", label: "Closed" },
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
        <div className="space-y-5">
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

                  {/* Status Badge & Workflow Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                        item.status === "closed"
                          ? "bg-blue-50 text-blue-800 border border-blue-200"
                          : item.status === "handed_over"
                          ? "bg-purple-50 text-purple-800 border border-purple-200"
                          : item.status === "verified"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : item.status === "confirmed"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : item.status === "dismissed"
                          ? "bg-gray-100 text-gray-500"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {item.status.replace("_", " ")}
                    </span>

                    {/* Step 1: Suggested -> Confirm / Dismiss */}
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

                    {/* Step 2: Confirmed or Proof Pending -> Record Proof Q&A */}
                    {(item.status === "confirmed" || item.status === "proof_pending") && (
                      <button
                        onClick={() => handleOpenProofModal(item)}
                        className="px-3 py-1 bg-[#B45309] hover:bg-[#92400E] text-white text-xs font-bold rounded-lg shadow-sm transition"
                      >
                        📝 Verify Proof Q&A
                      </button>
                    )}

                    {/* Step 3: Verified -> Handover Code Workflow */}
                    {item.status === "verified" && (
                      <button
                        onClick={() => {
                          setHandoverModalMatch(item);
                          setGeneratedCode(null);
                          setVerifyCodeInput("");
                        }}
                        className="px-3 py-1 bg-[#047857] hover:bg-[#065F46] text-white text-xs font-bold rounded-lg shadow-sm transition"
                      >
                        🔑 Handover Code & Verify
                      </button>
                    )}

                    {/* Step 4: Handed Over -> Close Case & Settle Reward */}
                    {item.status === "handed_over" && (
                      <button
                        onClick={() => {
                          setCloseModalMatch(item);
                          setSettledReward(String(item.lost_post.reward_amount || "0"));
                          setCloseNotes("");
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
                      >
                        🏁 Settle & Close Case
                      </button>
                    )}
                  </div>
                </div>

                {/* Logistics Bar (Meeting Mode & Settlement Info) */}
                <div className="px-6 py-2.5 bg-white border-b border-[#EFEAE0] flex flex-wrap items-center justify-between text-xs text-[#6B7280]">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-[#1C1C1E]">Meeting Mode:</span>
                    <div className="inline-flex rounded-lg border border-[#EFEAE0] p-0.5 bg-[#FAF7F2]">
                      <button
                        onClick={() => handleSetMeetingMode(item.id, "office")}
                        className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition ${
                          item.meeting_mode === "office"
                            ? "bg-[#047857] text-white shadow-xs"
                            : "text-[#6B7280] hover:text-[#1C1C1E]"
                        }`}
                      >
                        🏛️ Via Office
                      </button>
                      <button
                        onClick={() => handleSetMeetingMode(item.id, "direct")}
                        className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition ${
                          item.meeting_mode === "direct"
                            ? "bg-[#047857] text-white shadow-xs"
                            : "text-[#6B7280] hover:text-[#1C1C1E]"
                        }`}
                      >
                        🤝 Direct Meet
                      </button>
                    </div>
                  </div>

                  {item.reward_amount_settled && Number(item.reward_amount_settled) > 0 && (
                    <div className="flex items-center gap-2 text-emerald-800 font-bold bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                      <span>🎉 Reward Settled: ₹{item.reward_amount_settled}</span>
                    </div>
                  )}
                </div>

                {/* Side-by-Side Comparison */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-[#EFEAE0]">
                  {/* Lost Item Side */}
                  <div className="space-y-3 md:pr-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-800">
                        LOST ITEM (Claimant)
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
                          <span>🎁 Promised Reward:</span>
                          <strong>₹{item.lost_post.reward_amount}</strong>
                        </div>
                      )}
                    </div>

                    {/* Hidden Proof for admin */}
                    {item.lost_post.hidden_proof && (
                      <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900">
                        <span className="font-bold text-[10px] uppercase block mb-1 text-amber-800">
                          🔒 Confidential Proof On File (Secret):
                        </span>
                        <p className="italic font-medium">{item.lost_post.hidden_proof}</p>
                      </div>
                    )}
                  </div>

                  {/* Found Item Side */}
                  <div className="space-y-3 pt-4 md:pt-0 md:pl-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        FOUND ITEM (Finder)
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
                        <span>🏛️ Physical Custody:</span>
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

      {/* Action Dialog (Confirm / Dismiss) */}
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

      {/* Phase 6: Proof Q&A Modal */}
      {proofModalMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#EFEAE0] max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <h3 className="font-serif text-lg font-bold text-[#1C1C1E]">
              Hidden-Proof Verification Q&A
            </h3>
            <p className="text-xs text-[#6B7280]">
              Ask confidential verification questions to the claimant (e.g. colour, unique scratches, wallpaper, serial number) and record their answers.
            </p>

            {proofModalMatch.lost_post.hidden_proof && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <span className="font-bold text-[10px] uppercase block mb-1 text-amber-800">
                  Claimant Confidential Proof on Record:
                </span>
                <span className="italic">{proofModalMatch.lost_post.hidden_proof}</span>
              </div>
            )}

            {/* Questions List */}
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {proofQuestionsList.map((q, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#FAF7F2] border border-[#EFEAE0] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1C1C1E]">Question {idx + 1}</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.is_correct ?? true}
                        onChange={(e) => {
                          const updated = [...proofQuestionsList];
                          updated[idx].is_correct = e.target.checked;
                          setProofQuestionsList(updated);
                        }}
                        className="rounded text-[#047857]"
                      />
                      <span className="text-[11px] font-semibold text-emerald-800">Verified Correct</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={q.question}
                    onChange={(e) => {
                      const updated = [...proofQuestionsList];
                      updated[idx].question = e.target.value;
                      setProofQuestionsList(updated);
                    }}
                    placeholder="Verification question..."
                    className="w-full px-3 py-1.5 bg-white border border-[#EFEAE0] rounded-lg"
                  />
                  <input
                    type="text"
                    value={q.answer}
                    onChange={(e) => {
                      const updated = [...proofQuestionsList];
                      updated[idx].answer = e.target.value;
                      setProofQuestionsList(updated);
                    }}
                    placeholder="Recorded claimant answer..."
                    className="w-full px-3 py-1.5 bg-white border border-[#EFEAE0] rounded-lg"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() =>
                setProofQuestionsList([
                  ...proofQuestionsList,
                  { question: "", answer: "", is_correct: true },
                ])
              }
              className="text-xs font-bold text-[#047857] hover:underline"
            >
              + Add Another Question
            </button>

            {/* Decision selector */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-[#1C1C1E] mb-1">Verification Decision:</label>
              <select
                value={proofDecision}
                onChange={(e) => setProofDecision(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EFEAE0] rounded-xl text-xs font-semibold"
              >
                <option value="VERIFIED">✅ Mark as Verified (Move to Handover)</option>
                <option value="KEEP_PENDING">⏳ Keep Proof Pending (Incomplete Proof)</option>
                <option value="REJECT">❌ Reject / Dismiss (Incompatible)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1C1E] mb-1">Admin Remarks:</label>
              <textarea
                value={proofNotes}
                onChange={(e) => setProofNotes(e.target.value)}
                placeholder="Notes on proof inspection..."
                rows={2}
                className="w-full px-3 py-1.5 bg-[#FAF7F2] border border-[#EFEAE0] rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setProofModalMatch(null)}
                disabled={submittingAction}
                className="px-4 py-2 text-xs font-semibold text-[#6B7280]"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitProof}
                disabled={submittingAction}
                className="px-5 py-2 bg-[#047857] hover:bg-[#065F46] text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                {submittingAction ? "Saving..." : "Save Proof Evaluation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 6: Handover Code Modal */}
      {handoverModalMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-[#EFEAE0] max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#1C1C1E]">
              Single-Use Handover Verification
            </h3>
            <p className="text-xs text-[#6B7280]">
              Generate a one-time code for the owner to show at handover. When they meet, verify the code to mark the case handed over.
            </p>

            {/* Generated Code Display */}
            {generatedCode ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block">
                  One-Time Handover Code:
                </span>
                <span className="font-mono text-3xl font-extrabold text-[#047857] tracking-wider block">
                  {generatedCode}
                </span>
                <p className="text-[11px] text-[#4B5563]">
                  Share this code with the verified owner. It will expire immediately upon verification.
                </p>
              </div>
            ) : (
              <button
                onClick={() => handleGenerateCode(handoverModalMatch.id)}
                disabled={submittingAction}
                className="w-full py-2.5 bg-[#047857] hover:bg-[#065F46] text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                Generate One-Time Code
              </button>
            )}

            {/* Verify Code Form */}
            <div className="pt-2 border-t border-[#EFEAE0] space-y-3">
              <label className="block text-xs font-semibold text-[#1C1C1E]">
                Verify Presented Code (At Physical Meeting):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-char code"
                  value={verifyCodeInput}
                  onChange={(e) => setVerifyCodeInput(e.target.value.toUpperCase())}
                  className="flex-1 px-3 py-2 bg-[#FAF7F2] border border-[#EFEAE0] rounded-xl text-xs font-mono font-bold tracking-widest uppercase text-center"
                />
                <button
                  onClick={handleVerifyCode}
                  disabled={submittingAction || !verifyCodeInput.trim()}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  Verify & Hand Over
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setHandoverModalMatch(null);
                  setGeneratedCode(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-[#6B7280]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 6: Settle & Close Case Modal */}
      {closeModalMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-[#EFEAE0] max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#1C1C1E]">
              Settle Reward & Close Case
            </h3>
            <p className="text-xs text-[#6B7280]">
              Record the settled reward for the finder and close this case. Both the Lost and Found posts will be officially marked &quot;Returned&quot;.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#1C1C1E] mb-1">
                Settled Reward Amount (₹):
              </label>
              <input
                type="number"
                min="0"
                value={settledReward}
                onChange={(e) => setSettledReward(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EFEAE0] rounded-xl text-xs font-bold"
              />
              <span className="text-[10px] text-[#6B7280] block mt-1">
                Promised reward on post: ₹{closeModalMatch.lost_post.reward_amount || "0"}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1C1E] mb-1">
                Closing Remarks:
              </label>
              <textarea
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Case resolved peacefully, finder handed over item at office."
                rows={2}
                className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EFEAE0] rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setCloseModalMatch(null)}
                disabled={submittingAction}
                className="px-4 py-2 text-xs font-semibold text-[#6B7280]"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseCase}
                disabled={submittingAction}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                {submittingAction ? "Closing..." : "Close Case Officially"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
