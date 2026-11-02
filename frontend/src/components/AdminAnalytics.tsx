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
