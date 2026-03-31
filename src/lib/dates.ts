/**
 * Calendar helpers that avoid hydration mismatches:
 * - Never use toLocale* during SSR for user-visible strings unless inputs are fully deterministic.
 * - Prefer local date parts (getFullYear/getMonth/getDate) over toISOString() for "today" keys.
 */

const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const WEEKDAYS_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** YYYY-MM-DD in the environment’s local calendar (use only after mount for “today”). */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local calendar date (no UTC midnight shift). */
export function parseLocalDateOnly(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Long English date from YYYY-MM-DD — identical on server and client. */
export function formatIsoDateLongEn(iso: string): string {
  const d = parseLocalDateOnly(iso);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

/** Short label for study plan rows — identical for a given Date instance in the same TZ. */
export function formatPlanDayLabel(d: Date): string {
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/**
 * Whole calendar days from `from` (local date) to exam YYYY-MM-DD (local).
 * Only meaningful when `from` is supplied from the client after mount (or same TZ server).
 */
export function calendarDaysUntilExamLocal(from: Date, examDateIso: string): number {
  const end = parseLocalDateOnly(examDateIso);
  end.setHours(0, 0, 0, 0);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  start.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}
