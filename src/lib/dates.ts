import { weekStart } from "./engine/pulse";

const TZ = "Asia/Kolkata";

/** Today's calendar date in the institution timezone, as a UTC-midnight Date. */
export function todayLocal(d = new Date()) {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export const currentWeekStart = (startDay = 1) => weekStart(todayLocal(), startDay);

/** The last n week-start dates, oldest first. */
export function lastWeeks(n: number, startDay = 1) {
  const cur = new Date(`${currentWeekStart(startDay)}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(cur);
    d.setUTCDate(d.getUTCDate() - (n - 1 - i) * 7);
    return d.toISOString().slice(0, 10);
  });
}

export const fmtDate = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  iso ? new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...opts }).format(new Date(iso)) : "—";

export const fmtDateTime = (iso: string | null | undefined) =>
  fmtDate(iso, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
