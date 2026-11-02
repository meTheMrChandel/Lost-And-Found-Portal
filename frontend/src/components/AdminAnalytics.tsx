import { AdminStats } from "@/types/post";

function percent(part: number, whole: number): string {
  const value = (part / whole) * 100;
  return value > 0 && value < 1 ? "<1%" : `${Math.round(value)}%`;
}

export function RecoveryRateCard({ posts }: { posts: AdminStats["posts"] }) {
  // Rejected and hidden reports could never have been recovered through the portal
  const eligible = posts.total - posts.rejected - posts.hidden;

  return (
    <div className="p-6 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm">
      <h2 className="font-serif text-lg font-bold text-[#1C1C1E] mb-4">Recovery Rate</h2>
      {eligible > 0 ? (
        <>
          <span className="font-serif text-4xl font-bold text-[#047857]">
            {percent(posts.returned, eligible)}
          </span>
          <div className="h-2 rounded-full bg-[#EFEAE0] overflow-hidden mt-3">
            <div
              className="h-full rounded-full bg-[#047857]"
              style={{ width: `${(posts.returned / eligible) * 100}%` }}
            />
          </div>
          <p className="text-xs text-[#6B7280] mt-3">
            {posts.returned} of {eligible} reports closed by a handover. Each handover closes both
            the lost and the found report. Rejected and hidden reports are not counted.
          </p>
        </>
      ) : (
        <p className="text-xs text-[#6B7280]">No reports to measure yet.</p>
      )}
    </div>
  );
}

export function SlaGaugeCard({ posts }: { posts: AdminStats["posts"] }) {
  // Counted by separate queries, so overdue can briefly exceed pending between the two
  const overdue = Math.min(posts.sla_breached, posts.pending);
  const onTime = posts.pending - overdue;
  const onTimeShare = posts.pending > 0 ? Math.round((onTime / posts.pending) * 100) : 0;
  const arc = "M 10 60 A 50 50 0 0 1 110 60";

  return (
    <div className="p-6 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm">
      <h2 className="font-serif text-lg font-bold text-[#1C1C1E] mb-4">Review SLA</h2>
      <div className="flex items-center gap-6">
        <svg
          viewBox="0 0 120 68"
          className="w-40 shrink-0"
          role="img"
          aria-label={
            posts.pending > 0
              ? `${onTimeShare}% of pending reports are within the review window`
              : "No reports are waiting for review"
          }
        >
          <path d={arc} fill="none" strokeWidth="12" stroke={posts.pending > 0 ? "#D94F3B" : "#EFEAE0"} />
          {onTime > 0 && (
            <path d={arc} fill="none" strokeWidth="12" stroke="#047857" pathLength={100} strokeDasharray={`${onTimeShare} 100`} />
          )}
          {posts.pending > 0 && (
            <text x="60" y="58" textAnchor="middle" className="font-serif text-[22px] font-bold" fill="#1C1C1E">
              {onTimeShare}%
            </text>
          )}
        </svg>
        {posts.pending > 0 ? (
          <div className="text-xs space-y-2">
            <p className="font-semibold text-[#047857]">{onTime} within the review window</p>
            <p className="font-semibold text-[#D94F3B]">{overdue} overdue</p>
          </div>
        ) : (
          <p className="text-xs text-[#6B7280]">Nothing waiting for review.</p>
        )}
      </div>
    </div>
  );
}
