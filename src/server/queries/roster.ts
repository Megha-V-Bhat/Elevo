import "server-only";
import { cache } from "react";
import type { InsightReport } from "@/lib/engine/insights";
import { pulseSignals, type PulseSignal } from "@/lib/engine/pulse";
import type { RiskFlag } from "@/lib/engine/risk";
import { type Academics, insightsFrom, loadAcademics, riskFrom, thresholds } from "./academics";
import { signedUrl } from "../files";
import { db } from "../supabase";
import type { StudentProfile } from "./people";
import { toStrip } from "./pulse";
import { appSettings } from "./settings";

export type RosterEntry = {
  profile: StudentProfile;
  academics: Academics;
  report: InsightReport;
  flags: RiskFlag[];
  pulse: PulseSignal[];
  strip: ReturnType<typeof toStrip>;
  latestSgpa: number | null;
  sgpaDelta: number | null;
};

/** Everything a mentor (or HOD) needs per student for lists and needs-attention. */
export const roster = cache(async (studentIds: string[], includePulse: boolean): Promise<RosterEntry[]> => {
  if (!studentIds.length) return [];
  const supabase = await db();
  const [{ data: profiles }, settings] = await Promise.all([supabase.from("student_profiles").select("*").in("user_id", studentIds).order("full_name"), appSettings()]);
  const pulseRows = includePulse ? (((await supabase.rpc("mentor_pulse_overview", { p_weeks: 12 })).data ?? []) as { student_id: string; week_start: string; mood: number; workload: "LIGHT" | "OKAY" | "HEAVY"; subject_confidence: { subject: string; score: number }[]; has_note: boolean }[]) : [];
  const out: RosterEntry[] = [];
  for (const p of (profiles ?? []) as StudentProfile[]) {
    const a = await loadAcademics(p.user_id, p.department_id);
    const t = await thresholds(p.department_id);
    const report = insightsFrom(a, t.insight);
    const flags = riskFrom(a, report, { current_semester: p.current_semester, profile_completion: p.profile_completion, created_at: p.created_at }, t.risk);
    const mine = pulseRows.filter((r) => r.student_id === p.user_id);
    const withSgpa = a.semesters.filter((s) => s.sgpa != null);
    out.push({
      profile: { ...p, avatar_url: await signedUrl("avatars", p.avatar_path) },
      academics: a,
      report,
      flags,
      pulse: pulseSignals(mine.map((m) => ({ week_start: m.week_start, mood: m.mood, workload: m.workload, subject_confidence: m.subject_confidence ?? [] }))),
      strip: toStrip(mine.map((m) => ({ week_start: m.week_start, mood: m.mood, workload: m.workload, has_note: m.has_note })), settings.pulse_week_start),
      latestSgpa: withSgpa.at(-1)?.sgpa ?? null,
      sgpaDelta: withSgpa.length >= 2 ? Math.round(((withSgpa.at(-1)!.sgpa as number) - (withSgpa.at(-2)!.sgpa as number)) * 100) / 100 : null,
    });
  }
  return out;
});
