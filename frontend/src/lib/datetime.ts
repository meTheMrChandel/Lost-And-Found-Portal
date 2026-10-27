/**
 * Current *local* time as YYYY-MM-DDTHH:mm, the format <input type="datetime-local">
 * expects. Date.toISOString() is UTC, which shifts the default and the `max`
 * bound by the user's timezone offset (e.g. 5h30m behind in IST).
 *
 * Returns "" during server prerendering: there is no meaningful "now" for the
 * user there, and Next.js fails the build if a prerender reads the clock.
 */
export function nowForDateTimeInput(): string {
  if (typeof window === "undefined") return "";
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
