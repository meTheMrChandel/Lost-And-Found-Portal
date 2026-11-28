import { BadgeTone } from "../../ui/Badge";
import { BadgeCheck, CircleAlert, CircleX, Clock, EyeOff, Handshake, Hourglass, IconType } from "../../ui/icons";
import { formatDate as formatShortDate } from "../../utils/format";

type LegacyVariant = "lost" | "found" | "pending" | "approved" | "info" | "default";

interface StatusMeta {
  label: string;
  tone: BadgeTone;
  variant: LegacyVariant;
  icon: IconType;
  /** What the status means for the person who reported it. */
  description: string;
}

const STATUS: Record<string, StatusMeta> = {
  PENDING: {
    label: "Pending review",
    tone: "warning",
    variant: "pending",
    icon: Hourglass,
    description: "An admin will check your report soon. It goes on the public feed once approved.",
  },
  APPROVED: {
    label: "Live",
    tone: "success",
    variant: "approved",
    icon: BadgeCheck,
    description: "Your report is on the public feed, and new reports are checked against it for matches.",
  },
  INFO_REQUESTED: {
    label: "Needs info",
    tone: "info",
    variant: "info",
    icon: CircleAlert,
    description: "The admin needs a few more details before approving it. Update your report below.",
  },
  EXPIRED: {
    label: "Expired",
    tone: "neutral",
    variant: "default",
    icon: Clock,
    description: "This report is no longer on the feed. Renew it if you're still looking.",
  },
  RETURNED: {
    label: "Returned",
    tone: "brand",
    variant: "found",
    icon: Handshake,
    description: "This item has been handed over. Thanks for using Lost & Found.",
  },
  REJECTED: {
    label: "Rejected",
    tone: "danger",
    variant: "lost",
    icon: CircleX,
    description: "An admin didn't approve this report. The note below says why.",
  },
  HIDDEN: {
    label: "Hidden",
    tone: "neutral",
    variant: "default",
    icon: EyeOff,
    description: "An admin has taken this report off the feed.",
  },
};

export const REPORT_TABS = ["ALL", "PENDING", "APPROVED", "INFO_REQUESTED", "EXPIRED", "RETURNED", "REJECTED"];

export function statusMeta(status: string): StatusMeta {
  return (
    STATUS[status] || {
      label: status ? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ") : "Unknown",
      tone: "neutral",
      variant: "default",
      icon: Clock,
      description: "",
    }
  );
}

/** Label and badge colour for a report status (the admin screens use this). */
export function statusBadge(status: string): { label: string; variant: LegacyVariant; tone: BadgeTone } {
  const meta = statusMeta(status);
  return { label: meta.label, variant: meta.variant, tone: meta.tone };
}

export function tabLabel(tab: string): string {
  return tab === "ALL" ? "All" : statusMeta(tab).label;
}

export function formatDate(iso: string): string {
  return formatShortDate(iso);
}
