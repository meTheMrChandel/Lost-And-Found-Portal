"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { AdminStats } from "@/types/post";
import Link from "next/link";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await apiClient("/adminpanel/statistics/");
        if (res?.data) {
          setStats(res.data);
        }
      } catch (err) {
        console.error("Failed to load admin stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
            Admin Control Center
          </h1>
          <p className="text-sm text-[#6B7280]">
            Campus-wide Lost & Found case queue, moderation decisions, and live statistics.
          </p>
        </div>
        <Link
          href="/admin/cases"
          className="self-start md:self-auto px-5 py-2.5 rounded-xl bg-[#047857] hover:bg-[#10B981] text-white text-xs font-bold shadow-sm transition-all"
        >
          Open Case Queue →
        </Link>
      </div>

      {/* Case Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Pending Review */}
        <Link
          href="/admin/cases?status=PENDING"
          className="p-6 rounded-3xl bg-white border border-[#E2DDD2] hover:border-[#047857] shadow-sm transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">
                Pending Cases
              </span>
              {stats && stats.posts.sla_breached > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#D94F3B] text-white animate-pulse">
                  {stats.posts.sla_breached} OVERDUE
                </span>
              )}
            </div>
            <span className="font-serif text-4xl font-bold text-[#1C1C1E]">
              {loading ? "..." : stats?.posts.pending ?? 0}
            </span>
          </div>
          <span className="text-xs text-[#047857] font-semibold mt-3 block">
            Awaiting admin review →
          </span>
        </Link>

        {/* Live Approved */}
        <Link
          href="/admin/cases?status=APPROVED"
          className="p-6 rounded-3xl bg-white border border-[#E2DDD2] hover:border-[#047857] shadow-sm transition-all flex flex-col justify-between"
        >
          <div>
            <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider block mb-1">
              Active on Feed
            </span>
            <span className="font-serif text-4xl font-bold text-[#047857]">
              {loading ? "..." : stats?.posts.approved ?? 0}
            </span>
          </div>
          <span className="text-xs text-[#6B7280] mt-3 block">
            Publicly visible posts →
          </span>
        </Link>

        {/* Returned */}
        <div className="p-6 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider block mb-1">
              Successfully Returned
            </span>
            <span className="font-serif text-4xl font-bold text-[#047857]">
              {loading ? "..." : stats?.posts.returned ?? 0}
            </span>
          </div>
          <span className="text-xs text-[#6B7280] mt-3 block">
            Reunited with rightful owners
          </span>
        </div>

        {/* Flagged Abuse */}
        <Link
          href="/admin/abuse-reports"
          className="p-6 rounded-3xl bg-white border border-[#E2DDD2] hover:border-[#D94F3B] shadow-sm transition-all flex flex-col justify-between"
        >
          <div>
            <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider block mb-1">
              Abuse Reports
            </span>
            <span className="font-serif text-4xl font-bold text-[#D94F3B]">
              {loading ? "..." : stats?.abuse_reports.pending ?? 0}
            </span>
          </div>
          <span className="text-xs text-[#D94F3B] font-semibold mt-3 block">
            Flagged items needing action →
          </span>
        </Link>
      </div>

      {/* Middle Section: Categories & Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown (2 columns) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm">
          <h2 className="font-serif text-lg font-bold text-[#1C1C1E] mb-4">
            Items Reported by Category
          </h2>

          {loading ? (
            <p className="text-xs text-[#6B7280]">Loading category metrics...</p>
          ) : stats?.category_breakdown && stats.category_breakdown.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {stats.category_breakdown.map((cat) => (
                <div
                  key={cat.slug}
                  className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#EFEAE0] flex flex-col justify-between"
                >
                  <span className="text-xs font-medium text-[#6B7280] capitalize">
                    {cat.name}
                  </span>
                  <span className="font-serif text-xl font-bold text-[#1C1C1E] mt-1">
                    {cat.posts_count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#6B7280]">No categories reported yet.</p>
          )}
        </div>

        {/* User Statistics */}
        <div className="p-6 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#1C1C1E] mb-4">
              Community Health
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between pb-2 border-b border-[#EFEAE0]">
                <span className="text-[#6B7280]">Registered Students</span>
                <span className="font-bold text-[#1C1C1E]">
                  {stats?.users.students ?? 0}
                </span>
              </div>
              <div className="flex justify-between pb-2 border-b border-[#EFEAE0]">
                <span className="text-[#6B7280]">New This Week</span>
                <span className="font-bold text-[#047857]">
                  +{stats?.users.new_this_week ?? 0}
                </span>
              </div>
              <div className="flex justify-between pb-2 border-b border-[#EFEAE0]">
                <span className="text-[#6B7280]">Suspended Accounts</span>
                <span className="font-bold text-[#D94F3B]">
                  {stats?.users.banned ?? 0}
                </span>
              </div>
            </div>
          </div>
          <Link
            href="/admin/users"
            className="mt-6 block text-center py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#EFEAE0] text-xs font-bold text-[#1C1C1E] border border-[#E2DDD2] transition-colors"
          >
            Moderate Students →
          </Link>
        </div>
      </div>

      {/* Recent Moderation Activity Timeline */}
      {stats?.recent_activity && stats.recent_activity.length > 0 && (
        <div className="p-6 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-serif text-lg font-bold text-[#1C1C1E]">
              Recent Staff Moderation Actions
            </h2>
            <Link
              href="/admin/audit-logs"
              className="text-xs font-semibold text-[#047857] hover:underline"
            >
              View Full Audit Trail →
            </Link>
          </div>

          <div className="divide-y divide-[#EFEAE0]">
            {stats.recent_activity.map((act) => (
              <div key={act.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#047857]/10 text-[#047857] mr-2">
                    {act.action}
                  </span>
                  <span className="font-medium text-[#1C1C1E]">
                    {act.post_title || "Campus Post"}
                  </span>
                  <span className="text-[#6B7280] ml-2">by {act.admin_email}</span>
                </div>
                <span className="text-[11px] text-[#6B7280] font-mono">
                  {new Date(act.created_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
