"use client";

import { useApiQuery } from "@/lib/useApiQuery";

interface FeedbackEntry {
  id: string;
  rating: number;
  message: string;
  page: string;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
}

interface FeedbackResponse {
  data?: FeedbackEntry[];
  summary?: { count: number; average_rating: number | null };
}

export default function AdminFeedbackPage() {
  const { data, loading, error, refresh } = useApiQuery<FeedbackResponse>("/feedback/", "Failed to load feedback.");
  const entries = data?.data ?? [];
  const summary = data?.summary;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">Beta Feedback</h1>
          <p className="text-sm text-[#6B7280]">
            What students sent from the feedback form, newest first.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="self-start md:self-auto px-4 py-2 rounded-xl bg-white border border-[#E2DDD2] hover:bg-[#FAF7F2] text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-xs font-semibold">
          {error}
        </div>
      )}

      {summary && summary.count > 0 && (
        <p className="text-xs text-[#6B7280]">
          {summary.count} response{summary.count === 1 ? "" : "s"} · average rating{" "}
          <span className="font-bold text-[#1C1C1E]">{summary.average_rating} / 5</span>
        </p>
      )}

      <div className="p-6 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm">
        {loading && !data ? (
          <p className="text-xs text-[#6B7280] py-8 text-center">Loading feedback...</p>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#6B7280]">No feedback has been sent yet.</div>
        ) : (
          <div className="divide-y divide-[#EFEAE0]">
            {entries.map((entry) => (
              <div key={entry.id} className="py-4 flex flex-col sm:flex-row gap-3 sm:gap-6 text-xs">
                <span className="font-serif text-2xl font-bold text-[#1C1C1E] w-12 shrink-0">{entry.rating}/5</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[#1C1C1E] whitespace-pre-line break-words">{entry.message}</p>
                  <p className="text-[11px] text-[#6B7280] mt-1">
                    {entry.user_name || "Former user"}
                    {entry.user_email && ` · ${entry.user_email}`}
                    {entry.page && ` · from ${entry.page}`}
                  </p>
                </div>
                <span className="text-[11px] text-[#6B7280] font-mono whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
