"use client";

import { useEffect, useState } from "react";
import { apiClient, getErrorMessage } from "@/lib/api";
import { PostAuditLog } from "@/types/auth";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<PostAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient("/adminpanel/audit-logs/");
      if (res?.data) {
        setLogs(res.data);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load audit logs."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = filterAction
    ? logs.filter((log) =>
        log.action.toLowerCase().includes(filterAction.toLowerCase()) ||
        log.post_title?.toLowerCase().includes(filterAction.toLowerCase()) ||
        log.admin_email?.toLowerCase().includes(filterAction.toLowerCase())
      )
    : logs;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
            Post Audit Logs
          </h1>
          <p className="text-sm text-[#6B7280]">
            Immutable record of all moderation decisions, status changes, and staff operations.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="self-start md:self-auto px-4 py-2 rounded-xl bg-white border border-[#E2DDD2] hover:bg-[#FAF7F2] text-xs font-semibold transition-all cursor-pointer shadow-sm"
        >
          {loading ? "Refreshing..." : "↻ Refresh Logs"}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Filter / Search input */}
      <div className="max-w-md">
        <input
          type="text"
          placeholder="Filter by action, post title, or admin..."
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-xs"
        />
      </div>

      {/* Audit Log Table */}
      <div className="p-6 rounded-2xl bg-white border border-[#E2DDD2] shadow-sm">
        <h2 className="font-serif text-lg font-bold text-[#1C1C1E] mb-4">
          Audit Entries ({filteredLogs.length})
        </h2>

        {loading && logs.length === 0 ? (
          <p className="text-xs text-[#6B7280] py-6 text-center">
            Loading audit records...
          </p>
        ) : filteredLogs.length === 0 ? (
          <p className="text-xs text-[#6B7280] py-8 text-center">
            No audit log entries recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EFEAE0] text-[#6B7280] font-semibold uppercase">
                <tr>
                  <th className="pb-3 px-2">Timestamp</th>
                  <th className="pb-3 px-2">Admin User</th>
                  <th className="pb-3 px-2">Target Post</th>
                  <th className="pb-3 px-2">Action</th>
                  <th className="pb-3 px-2">Status Shift</th>
                  <th className="pb-3 px-2">Moderation Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]/60">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF7F2]/50">
                    <td className="py-3 px-2 text-[#6B7280] whitespace-nowrap font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-3 px-2 font-medium text-[#1C1C1E]">
                      {log.admin_email || "System"}
                    </td>
                    <td className="py-3 px-2 text-[#1C1C1E] max-w-xs truncate font-medium">
                      {log.post_title || `Post #${log.post?.slice(0, 8)}`}
                    </td>
                    <td className="py-3 px-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#047857]/15 text-[#047857] uppercase tracking-wider">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-[#6B7280]">
                      {log.previous_status || log.new_status ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono">
                          <span className="text-[#6B7280]">
                            {log.previous_status || "—"}
                          </span>
                          <span>→</span>
                          <span className="text-[#1C1C1E] font-semibold">
                            {log.new_status || "—"}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#6B7280]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-[#6B7280] max-w-sm truncate text-[11px]">
                      {log.notes || "—"}
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
