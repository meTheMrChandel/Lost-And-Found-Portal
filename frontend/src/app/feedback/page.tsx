"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiClient, getErrorMessage } from "@/lib/api";
import Logo from "@/components/Logo";
import LoginRequired from "@/components/LoginRequired";
import SessionCheck from "@/components/SessionCheck";

const RATINGS = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Fair" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];

function FeedbackForm() {
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  // Page the student came from, so feedback can be tied to a screen
  const from = searchParams.get("from") ?? "";
  const page = from.startsWith("/") ? from.slice(0, 200) : "";

  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  if (loading) return <SessionCheck />;
  if (!user) {
    return (
      <LoginRequired
        returnTo={page ? `/feedback?from=${encodeURIComponent(page)}` : "/feedback"}
        message="Sign in with your campus account to tell us how the portal is working for you."
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    setSending(true);
    setError("");
    try {
      const res = await apiClient("/feedback/", {
        method: "POST",
        data: { rating, message: message.trim(), page },
      });
      setSent(res.message || "Thanks for your feedback.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send feedback."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF7F2]">
      <div className="w-full max-w-lg p-8 rounded-3xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-lg">
        <div className="text-center mb-6">
          <Logo size={48} variant="tile" className="mx-auto mb-4" />
          <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">Beta Feedback</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Tell the team what works and what gets in your way.
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-5">
            <div className="p-4 rounded-2xl bg-[#047857]/10 border border-[#047857]/20 text-[#047857] text-sm font-medium">
              {sent}
            </div>
            <Link href={page || "/"} className="inline-block text-sm font-semibold text-[#047857] hover:underline">
              ← Back to the portal
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-sm font-medium">
                {error}
              </div>
            )}
            <div>
              <span className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
                How is it working for you?
              </span>
              <div className="grid grid-cols-5 gap-2">
                {RATINGS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRating(r.value)}
                    aria-pressed={rating === r.value}
                    className={`py-2.5 rounded-2xl text-xs font-semibold border transition-colors ${
                      rating === r.value
                        ? "bg-[#047857] border-[#047857] text-white"
                        : "bg-white border-[#E2DDD2] text-[#1C1C1E] hover:bg-[#FAF7F2]"
                    }`}
                  >
                    <span className="block text-base font-bold">{r.value}</span>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
                Your feedback
              </span>
              <textarea
                required
                rows={5}
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What did you try to do, and what happened?"
                className="w-full px-4 py-3 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-[#1C1C1E] text-sm shadow-sm"
              />
            </label>
            <button
              type="submit"
              disabled={!rating || !message.trim() || sending}
              className="w-full py-3.5 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-sm font-semibold shadow-md transition-all disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send Feedback"}
            </button>
            <Link href={page || "/"} className="text-center text-xs font-semibold text-[#6B7280] hover:text-[#1C1C1E]">
              Cancel
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<SessionCheck />}>
      <FeedbackForm />
    </Suspense>
  );
}
