"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { Post } from "@/types/post";

const MAX_POSTS = 3;

function timeAgo(dateString: string) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(dateString).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export default function RecentActivity() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await apiClient("/posts/feed/?ordering=-created_at&include_pending=true");
        if (res?.data) {
          setPosts(res.data.slice(0, MAX_POSTS));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load recent activity.");
      } finally {
        setLoading(false);
      }
    };
    fetchRecent();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: MAX_POSTS }).map((_, i) => (
          <div
            key={i}
            className="p-6 rounded-2xl bg-[#EFEAE0]/80 border border-[#EFEAE0] animate-pulse flex flex-col gap-4"
          >
            <div className="h-5 w-16 rounded-full bg-[#E2DDD2]" />
            <div className="h-6 w-3/4 rounded bg-[#E2DDD2]" />
            <div className="h-4 w-full rounded bg-[#E2DDD2]" />
            <div className="h-4 w-1/2 rounded bg-[#E2DDD2]" />
          </div>
        ))}
      </div>
    );
  }

  if (error || posts.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-[#EFEAE0]/60 border border-dashed border-[#E2DDD2] text-center">
        <p className="font-serif text-lg font-bold text-[#1C1C1E] mb-1">
          {error ? "Activity is unavailable right now" : "No approved reports yet"}
        </p>
        <p className="text-sm text-[#6B7280] mb-4">
          {error
            ? "We couldn't reach the campus feed. Please try again in a moment."
            : "Reports appear here once an admin verifies them."}
        </p>
        <Link
          href="/report/lost"
          className="inline-block px-4 py-2 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-xs font-bold shadow-sm transition-all"
        >
          Submit a Report
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {posts.map((post) => (
        <Link
          key={post.id}
          href="/feed"
          className="p-6 rounded-2xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white ${
                  post.post_type === "LOST" ? "bg-[#D94F3B]" : "bg-[#047857]"
                }`}
              >
                {post.post_type}
              </span>
              {Number(post.reward_amount) > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold text-[#1C1C1E] bg-[#F5B73B]">
                  ₹{post.reward_amount} Reward
                </span>
              )}
            </div>
            <h4 className="font-serif text-xl font-bold text-[#1C1C1E] mb-2 line-clamp-1">
              {post.title}
            </h4>
            <p className="text-sm text-[#6B7280] mb-4 line-clamp-2">
              {post.description}
            </p>
          </div>
          <div className="text-xs text-[#6B7280] pt-4 border-t border-[#E2DDD2] flex justify-between gap-2">
            <span className="truncate">{post.last_seen_place}</span>
            <span className="shrink-0">{timeAgo(post.created_at)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
