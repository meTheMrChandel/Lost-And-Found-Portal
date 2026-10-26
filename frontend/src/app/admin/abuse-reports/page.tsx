"use client";

import { useState } from "react";
import { apiClient, getErrorMessage } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { AbuseReport } from "@/types/post";

export default function AdminAbuseReportsPage() {
  const [actionError, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const {
    data: reportsRes,
    loading,
    error: loadError,
    refresh,
  } = useApiQuery<{ data?: AbuseReport[] }>("/adminpanel/abuse-reports/", "Failed to load abuse reports.");
  const reports = reportsRes?.data ?? [];
  const error = actionError || loadError;

  const refreshReports = () => {
    setError("");
    refresh();
  };

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    setMsg("");
    setError("");
    try {
      const res = await apiClient(`/adminpanel/abuse-reports/${id}/resolve/`, {
        method: "POST",
      });
      setMsg(res.message || "Abuse report marked as resolved.");
      refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to resolve report."));
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
            Abuse & Flagged Content
          </h1>
          <p className="text-sm text-[#6B7280]">
            Review reports submitted by campus students regarding fraudulent items, spam, or inappropriate content.
          </p>
        </div>
        <button
          onClick={refreshReports}
          disabled={loading}
          className="self-start md:self-auto px-4 py-2 rounded-xl bg-white border border-[#E2DDD2] hover:bg-[#FAF7F2] text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          {loading ? "Refreshing..." : "↻ Refresh Reports"}
        </button>
      </div>

      {msg && (
        <div className="p-4 rounded-2xl bg-[#047857]/10 border border-[#047857]/20 text-[#047857] text-xs font-semibold">
          {msg}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Reports Table */}
      <div className="p-6 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm">
        {loading ? (
          <p className="text-xs text-[#6B7280] py-8 text-center">Loading abuse reports...</p>
        ) : reports.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#6B7280]">
            No abuse reports have been flagged by students.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EFEAE0] text-[#6B7280] font-semibold uppercase">
                <tr>
                  <th className="pb-3 px-2">Reported Post</th>
                  <th className="pb-3 px-2">Reason Flagged</th>
                  <th className="pb-3 px-2">Student Reporter</th>
                  <th className="pb-3 px-2">Student Comments</th>
                  <th className="pb-3 px-2">Status</th>
                  <th className="pb-3 px-2">Timestamp</th>
                  <th className="pb-3 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]/60">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                    <td className="py-3.5 px-2 font-medium text-[#1C1C1E]">
                      <span className="block font-bold">{r.post_title || "Target Post"}</span>
                      <span className="text-[10px] text-[#6B7280] font-mono">
                        ID: #{r.post?.slice(0, 8)}
                      </span>
                    </td>
                    <td className="py-3.5 px-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#D94F3B]/10 text-[#D94F3B]">
                        {r.reason}
                      </span>
                    </td>
                    <td className="py-3.5 px-2 text-[#6B7280]">
                      <div className="font-medium text-[#1C1C1E]">{r.reporter_name || "Student"}</div>
                      <div className="text-[10px]">{r.reporter_email}</div>
                    </td>
                    <td className="py-3.5 px-2 text-[#6B7280] max-w-xs truncate">
                      {r.description || "No description provided."}
                    </td>
                    <td className="py-3.5 px-2">
                      {r.is_resolved ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#047857]/15 text-[#047857]">
                          ✓ RESOLVED
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#F5B73B]/20 text-[#B45309]">
                          ⏳ NEEDS REVIEW
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-2 text-[#6B7280] text-[11px] font-mono whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-2 text-right">
                      {!r.is_resolved ? (
                        <button
                          onClick={() => handleResolve(r.id)}
                          disabled={resolvingId === r.id}
                          className="px-3 py-1.5 rounded-xl bg-[#047857] hover:bg-[#10B981] text-white text-[11px] font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                        >
                          {resolvingId === r.id ? "Resolving..." : "Mark Resolved"}
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#6B7280] italic">
                          Resolved by {r.resolved_by_email?.split("@")[0] || "admin"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
