type BadgeVariant = "lost" | "found" | "pending" | "approved" | "info" | "default";

const STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: "Pending Review", variant: "pending" },
  APPROVED: { label: "Live", variant: "approved" },
  INFO_REQUESTED: { label: "More Info Needed", variant: "info" },
  EXPIRED: { label: "Expired", variant: "default" },
  RETURNED: { label: "Returned", variant: "found" },
  REJECTED: { label: "Rejected", variant: "lost" },
  HIDDEN: { label: "Hidden", variant: "default" },
};

export const REPORT_TABS = ["ALL", "PENDING", "APPROVED", "INFO_REQUESTED", "EXPIRED", "RETURNED", "REJECTED"];

export function statusBadge(status: string): { label: string; variant: BadgeVariant } {
  return STATUS[status] || { label: status, variant: "default" };
}

export function tabLabel(tab: string): string {
  return tab === "ALL" ? "All" : statusBadge(tab).label;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
