export type Workload = "LIGHT" | "OKAY" | "HEAVY";

export type PulseCheckin = {
  week_start: string; // ISO date (yyyy-mm-dd) of the week's first day
  mood: number; // 1–5
  workload: Workload;
  subject_confidence: { subject: string; score: number }[];
};

export type PulseSignal = { ruleId: string; label: string; reason: string; selfReported: true };

export const MOOD_LABELS = ["", "Rough", "Low", "Okay", "Good", "Great"] as const;

const DAY = 86_400_000;
const weekIndex = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / (7 * DAY));

/** Runs of check-ins in consecutive calendar weeks. A skipped week breaks a run but is never itself a signal. */
function consecutiveTail(checkins: PulseCheckin[]): PulseCheckin[] {
  const sorted = [...checkins].sort((a, b) => a.week_start.localeCompare(b.week_start));
  const tail: PulseCheckin[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (tail.length && weekIndex(tail[0].week_start) - weekIndex(sorted[i].week_start) !== 1) break;
    tail.unshift(sorted[i]);
  }
  return tail;
}

/** Mentor-only Pulse signals. Always labelled self-reported; missing check-ins never raise a signal. */
export function pulseSignals(checkins: PulseCheckin[]): PulseSignal[] {
  const out: PulseSignal[] = [];
  const tail = consecutiveTail(checkins);

  const last3 = tail.slice(-3);
  if (last3.length === 3 && last3.every((c) => c.mood <= 2)) {
    out.push({
      ruleId: "pulse-low-3",
      label: "Low pulse 3 weeks in a row",
      reason: `Moods ${last3.map((c) => MOOD_LABELS[c.mood]).join(", ")} for the weeks of ${last3.map((c) => c.week_start).join(", ")}`,
      selfReported: true,
    });
  }

  const last2 = tail.slice(-2);
  if (last2.length === 2 && last2.every((c) => c.workload === "HEAVY")) {
    const lowIn = (c: PulseCheckin) => new Set(c.subject_confidence.filter((s) => s.score <= 2).map((s) => s.subject));
    const a = lowIn(last2[0]);
    const both = [...lowIn(last2[1])].filter((s) => a.has(s));
    for (const subject of both) {
      out.push({
        ruleId: "pulse-heavy-low-confidence",
        label: `Heavy workload + low confidence in ${subject}`,
        reason: `Workload Heavy and ${subject} confidence ≤ 2 for 2 weeks in a row`,
        selfReported: true,
      });
    }
  }
  return out;
}

/** A kind, data-based reflection line for the student's own Pulse page. */
export function reflectionLine(checkins: PulseCheckin[]): string | null {
  if (checkins.length < 3) return null;
  const heavy = checkins.filter((c) => c.workload === "HEAVY").length;
  const avg = checkins.reduce((a, c) => a + c.mood, 0) / checkins.length;
  const sorted = [...checkins].sort((a, b) => a.week_start.localeCompare(b.week_start));
  const recent = sorted.slice(-3).reduce((a, c) => a + c.mood, 0) / Math.min(3, sorted.length);
  if (heavy >= Math.ceil(checkins.length / 2))
    return `Half or more of your weeks felt heavy. Planning a lighter buffer before exams could help.`;
  if (recent > avg + 0.4) return `Your last few weeks felt better than your usual. Whatever you changed, it's working.`;
  if (recent < avg - 0.4) return `The last few weeks have been tougher than usual. Your mentor is a message away.`;
  return `Your weeks have been fairly steady. Keep checking in — it helps your mentor support you early.`;
}

/** Monday-based (or configured) start of the week for a date, as yyyy-mm-dd. */
export function weekStart(date: Date, startDay = 1): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const diff = (d.getUTCDay() - startDay + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}
