const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function parse(iso?: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "26 Nov", with the year when it isn't this year. */
export function formatDate(iso?: string | null): string {
  const date = parse(iso);
  if (!date) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

/** "26 Nov, 4:30 pm". */
export function formatDateTime(iso?: string | null): string {
  const date = parse(iso);
  if (!date) return "—";
  return `${formatDate(iso)}, ${date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
}

/** "4:30 pm". */
export function formatTime(iso?: string | null): string {
  const date = parse(iso);
  return date ? date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "";
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "4 days ago", then the date. */
export function timeAgo(iso?: string | null): string {
  const date = parse(iso);
  if (!date) return "";
  const diff = Date.now() - date.getTime();
  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
  const days = Math.floor(diff / DAY);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

/** Short stamp for lists: the time today, "Yesterday", the weekday this week, else the date. */
export function listStamp(iso?: string | null): string {
  const date = parse(iso);
  if (!date) return "";
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (days === 0) return formatTime(iso);
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString("en-IN", { weekday: "short" });
  return formatDate(iso);
}

/** "Today", "Yesterday" or a full date, for separators in a conversation. */
export function dayLabel(iso?: string | null): string {
  const date = parse(iso);
  if (!date) return "";
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** "PROOF_PENDING" → "Proof pending". */
export function humanize(value?: string | null): string {
  if (!value) return "—";
  const words = value.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "₹1,500" (no paise when whole). */
export function formatRupees(amount?: number | string | null): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "₹0";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: Number.isInteger(value) ? 0 : 2 })}`;
}
