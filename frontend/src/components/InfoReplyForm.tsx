"use client";

import { useState } from "react";
import { apiClient, getErrorMessage } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { Post } from "@/types/post";

const inputClass =
  "w-full px-3 py-2 rounded-xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-[#1C1C1E] text-xs";

function ReplyFields({ post, onSent }: { post: Post; onSent: (message: string) => void }) {
  const [description, setDescription] = useState(post.description ?? "");
  const [place, setPlace] = useState(post.last_seen_place);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Any edit sends the report back to review, so it must actually answer something
  const changed = description.trim() !== (post.description ?? "").trim() || place.trim() !== post.last_seen_place.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await apiClient(`/posts/lost/${post.id}/`, {
        method: "PATCH",
        data: { description: description.trim(), last_seen_place: place.trim() },
      });
      onSent(res.message || "Report updated and sent back for admin review.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update your report."));
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
      <p className="font-bold text-[#1C1C1E]">Update your report with the details the admin asked for</p>
      {error && <p className="font-medium text-[#D94F3B]">{error}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-semibold text-[#6B7280]">Description</span>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-semibold text-[#6B7280]">Last seen location</span>
        <input type="text" value={place} onChange={(e) => setPlace(e.target.value)} className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={!changed || !place.trim() || sending}
        className="self-start px-5 py-2.5 rounded-xl bg-[#047857] hover:bg-[#10B981] text-white text-xs font-bold transition-all disabled:opacity-50"
      >
        {sending ? "Sending..." : "Send Update to Admin"}
      </button>
    </form>
  );
}

/** Lets the author of a report answer an admin's request for more information. */
export default function InfoReplyForm({ postId, onSent }: { postId: string; onSent: (message: string) => void }) {
  // The My Reports list leaves out the description, so load the full report first
  const { data, error } = useApiQuery<{ data?: Post }>(`/posts/lost/${postId}/`, "Failed to load this report.");

  if (error) return <p className="text-xs font-medium text-[#D94F3B]">{error}</p>;
  if (!data?.data) return <p className="text-xs text-[#6B7280]">Loading your report...</p>;
  return <ReplyFields post={data.data} onSent={onSent} />;
}
