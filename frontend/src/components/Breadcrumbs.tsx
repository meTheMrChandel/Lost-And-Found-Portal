"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Label per path segment; segments without one (ids) are left out of the trail
const LABELS: Record<string, string> = {
  feed: "Campus Feed",
  "my-reports": "My Reports",
  items: "My Valuables",
  profile: "Profile",
  report: "Report",
  lost: "Lost Item",
  found: "Found Item",
  admin: "Admin",
  cases: "Case Queue",
  matches: "Match Queue",
  "abuse-reports": "Abuse Reports",
  users: "User Moderation",
  invites: "Admin Invites",
  "audit-logs": "Audit Logs",
  settings: "Site Configuration",
};

// In the URL but not a page of their own, so shown without a link
const NO_PAGE = new Set(["report"]);

export default function Breadcrumbs({ className = "" }: { className?: string }) {
  const segments = usePathname().split("/").filter(Boolean);
  const crumbs = segments.flatMap((segment, i) =>
    LABELS[segment] ? [{ segment, label: LABELS[segment], href: "/" + segments.slice(0, i + 1).join("/") }] : []
  );

  return (
    <nav aria-label="Breadcrumb" className={`text-xs text-[#6B7280] ${className}`}>
      <Link href="/" className="hover:text-[#1C1C1E]">
        Home
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href}>
          <span className="mx-1.5">/</span>
          {i === crumbs.length - 1 ? (
            <span aria-current="page" className="text-[#1C1C1E]">
              {crumb.label}
            </span>
          ) : NO_PAGE.has(crumb.segment) ? (
            crumb.label
          ) : (
            <Link href={crumb.href} className="hover:text-[#1C1C1E]">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
