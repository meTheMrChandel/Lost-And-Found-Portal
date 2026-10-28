"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiClient, getErrorMessage, mediaUrl } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { Post, PostStatus } from "@/types/post";
import Logo from "@/components/Logo";
import Breadcrumbs from "@/components/Breadcrumbs";
import HeaderAccount from "@/components/HeaderAccount";

function MyReportsContent() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const justSubmitted = searchParams.get("submitted") === "true";

  const [actionError, setError] = useState("");
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [selectedReport, setSelectedReport] = useState<Post | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Only fetch once the signed-in user is known
  const {
    data: reportsRes,
    loading,
    error: loadError,
    refresh,
  } = useApiQuery<{ data?: Post[] }>(user ? "/posts/lost/my-reports/" : null, "Failed to load your reports.");
  const reports = reportsRes?.data ?? [];
  const error = actionError || loadError;

  const handleWithdraw = async (postId: string) => {
    if (!confirm("Are you sure you want to withdraw this lost item report?")) return;
    setActionLoading(true);
    try {
      await apiClient(`/posts/lost/${postId}/`, { method: "DELETE" });
      setActionMsg("Report withdrawn successfully.");
      setSelectedReport(null);
      refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to withdraw report."));
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: PostStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#F5B73B]/15 text-[#B45309]">
            ⏳ PENDING REVIEW
          </span>
        );
      case "APPROVED":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#047857]/15 text-[#047857]">
            ✓ LIVE / APPROVED
          </span>
        );
      case "INFO_REQUESTED":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
            ℹ MORE INFO NEEDED
          </span>
        );
      case "RETURNED":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#047857] text-white">
            ★ RETURNED
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#D94F3B]/15 text-[#D94F3B]">
            ✕ REJECTED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#EFEAE0] text-[#1C1C1E]">
            {status}
          </span>
        );
    }
  };

  const filteredReports = reports.filter((r) => {
    if (activeTab === "ALL") return true;
    return r.status === activeTab;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-xs text-[#6B7280]">
        Loading user reports...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl border border-[#E2DDD2] max-w-md w-full text-center">
          <h2 className="font-serif text-2xl font-bold text-[#1C1C1E] mb-2">
            Please Log In
          </h2>
          <p className="text-xs text-[#6B7280] mb-6">
            Sign in with your campus account to view your lost and found ticket history.
          </p>
          <Link
            href="/login?redirect=/my-reports"
            className="block w-full py-3 rounded-full bg-[#047857] text-white text-xs font-bold"
          >
            Log In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1C1E] flex flex-col">
      {/* Top Header */}
      <header className="border-b border-[#EFEAE0] bg-[#FAF7F2]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={32} />
            <span className="font-serif text-lg font-bold text-[#1C1C1E]">
              Lost & Found
            </span>
          </Link>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link
              href="/report/lost"
              className="px-4 py-2 rounded-full bg-[#047857] hover:bg-[#10B981] text-white transition-all shadow-sm"
            >
              + Report Lost Item
            </Link>
            <Link
              href="/"
              className="text-[#6B7280] hover:text-[#1C1C1E] transition-colors"
            >
              Back to Home
            </Link>
            <HeaderAccount />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        <Breadcrumbs />
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
            My Lost Item Reports
          </h1>
          <p className="text-sm text-[#6B7280]">
            Track the status of your reported missing items and review feedback from campus admins.
          </p>
        </div>

        {justSubmitted && (
          <div className="p-4 rounded-2xl bg-[#047857]/10 border border-[#047857]/20 text-[#047857] text-xs font-semibold">
            ✓ Your lost item report has been submitted to the campus admin office for review!
          </div>
        )}

        {actionMsg && (
          <div className="p-4 rounded-2xl bg-[#047857]/10 border border-[#047857]/20 text-[#047857] text-xs font-semibold">
            {actionMsg}
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Tab Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-[#EFEAE0]">
          {["ALL", "PENDING", "APPROVED", "INFO_REQUESTED", "RETURNED", "REJECTED"].map(
            (tab) => {
              const count =
                tab === "ALL"
                  ? reports.length
                  : reports.filter((r) => r.status === tab).length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === tab
                      ? "bg-[#1C1C1E] text-white shadow-sm"
                      : "bg-white text-[#6B7280] hover:text-[#1C1C1E] border border-[#E2DDD2]"
                  }`}
                >
                  {tab.replace("_", " ")} ({count})
                </button>
              );
            }
          )}
        </div>

        {/* Reports Grid */}
        {loading ? (
          <div className="p-12 text-center text-xs text-[#6B7280]">
            Loading your tickets...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white border border-[#E2DDD2] text-center flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#FAF7F2] text-xl flex items-center justify-center">
              📂
            </div>
            <h3 className="font-serif text-lg font-bold text-[#1C1C1E]">
              No reports in this tab
            </h3>
            <p className="text-xs text-[#6B7280] max-w-sm">
              You haven&apos;t reported any items in this category yet.
            </p>
            <Link
              href="/report/lost"
              className="mt-2 px-6 py-2.5 rounded-full bg-[#047857] text-white text-xs font-bold shadow-sm"
            >
              Report a Lost Belonging
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className="bg-white rounded-3xl border border-[#E2DDD2] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    {getStatusBadge(report.status)}
                    {Number(report.reward_amount) > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F5B73B] text-[#1C1C1E]">
                        ₹{report.reward_amount} Reward
                      </span>
                    )}
                  </div>

                  {/* Thumbnail if any */}
                  {report.images && report.images.length > 0 && (
                    <div className="w-full h-40 rounded-2xl overflow-hidden mb-4 bg-[#FAF7F2] border border-[#EFEAE0]">
                      <img
                        src={mediaUrl(report.images[0].image)}
                        alt={report.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  )}

                  <h3 className="font-serif text-lg font-bold text-[#1C1C1E] mb-1 group-hover:text-[#047857] transition-colors">
                    {report.title}
                  </h3>
                  <p className="text-[11px] text-[#6B7280] uppercase tracking-wider mb-2 font-semibold">
                    Category: {report.category_name || report.category}
                  </p>

                  <p className="text-xs text-[#6B7280] line-clamp-2 mb-3">
                    📍 {report.last_seen_place}
                  </p>

                  {/* Admin feedback banner if present */}
                  {report.admin_remarks && (
                    <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-[11px] text-[#1C1C1E] mb-3">
                      <span className="font-bold text-[#047857] block mb-0.5">
                        Admin Note:
                      </span>
                      {report.admin_remarks}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#EFEAE0] flex items-center justify-between text-[10px] text-[#6B7280]">
                  <span>
                    Reported on{" "}
                    {new Date(report.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="font-bold text-[#047857]">View Details →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-[#1C1C1E]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#E2DDD2] flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#6B7280] uppercase font-bold block">
                  Report ID: #{selectedReport.id.slice(0, 8)}
                </span>
                <h2 className="font-serif text-2xl font-bold text-[#1C1C1E]">
                  {selectedReport.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="w-8 h-8 rounded-full bg-[#FAF7F2] hover:bg-[#EFEAE0] text-[#6B7280] flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2">
              {getStatusBadge(selectedReport.status)}
              <span className="text-xs text-[#6B7280]">
                Category: {selectedReport.category_name || selectedReport.category}
              </span>
            </div>

            {/* Photos */}
            {selectedReport.images && selectedReport.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto py-2">
                {selectedReport.images.map((img) => (
                  <img
                    key={img.id}
                    src={mediaUrl(img.image)}
                    alt="attachment"
                    className="w-24 h-24 object-cover rounded-xl border border-[#E2DDD2]"
                  />
                ))}
              </div>
            )}

            {/* Last Seen */}
            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs flex flex-col gap-1.5">
              <div>
                <span className="text-[#6B7280] font-semibold">Location: </span>
                <span className="font-medium text-[#1C1C1E]">
                  {selectedReport.last_seen_place}
                </span>
              </div>
              <div>
                <span className="text-[#6B7280] font-semibold">Date & Time: </span>
                <span className="font-medium text-[#1C1C1E]">
                  {new Date(selectedReport.last_seen_time).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              {Number(selectedReport.reward_amount) > 0 && (
                <div>
                  <span className="text-[#6B7280] font-semibold">Promised Reward: </span>
                  <span className="font-bold text-[#047857]">
                    ₹{selectedReport.reward_amount}
                  </span>
                </div>
              )}
            </div>

            {/* Admin remarks */}
            {selectedReport.admin_remarks && (
              <div className="p-4 rounded-2xl bg-[#047857]/10 border border-[#047857]/20 text-xs">
                <span className="font-bold text-[#047857] block mb-1">
                  Admin Review Notes
                </span>
                <p className="text-[#1C1C1E]">{selectedReport.admin_remarks}</p>
              </div>
            )}

            {/* Actions for Pending or Info Requested */}
            <div className="pt-4 border-t border-[#EFEAE0] flex justify-between items-center">
              {(selectedReport.status === "PENDING" ||
                selectedReport.status === "INFO_REQUESTED") && (
                <button
                  onClick={() => handleWithdraw(selectedReport.id)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#D94F3B] hover:bg-[#D94F3B]/10 transition-colors"
                >
                  {actionLoading ? "Withdrawing..." : "Withdraw Report"}
                </button>
              )}

              <button
                onClick={() => setSelectedReport(null)}
                className="ml-auto px-5 py-2.5 rounded-xl bg-[#1C1C1E] hover:bg-black text-white text-xs font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-xs text-[#6B7280]">
          Loading reports...
        </div>
      }
    >
      <MyReportsContent />
    </Suspense>
  );
}
