import "server-only";
import { lastWeeks } from "@/lib/dates";
import type { PulseCheckin } from "@/lib/engine/pulse";
import { db } from "../supabase";

export type PulseRow = {
  id: string;
  week_start: string;
  mood: number;
  workload: "LIGHT" | "OKAY" | "HEAVY";
  subject_confidence: { subject_id: string; subject: string; score: number }[];
  help_note: string | null;
  share_note?: boolean;
  note_shared?: boolean;
  seen_by_mentor_at: string | null;
};

export async function ownPulse(studentId: string, weeks = 12) {
  const supabase = await db();
  const { data } = await supabase
    .from("pulse_checkins")
    .select("id, week_start, mood, workload, subject_confidence, help_note, share_note, seen_by_mentor_at")
    .eq("student_id", studentId)
    .order("week_start", { ascending: false })
    .limit(weeks);
  return (data ?? []) as PulseRow[];
}

/** Mentor view through the SECURITY DEFINER function — help notes only when shared. */
export async function mentorPulse(studentId: string, weeks = 12) {
  const supabase = await db();
  const { data, error } = await supabase.rpc("mentor_pulse", { p_student: studentId, p_weeks: weeks });
  if (error) return [];
  return (data ?? []) as PulseRow[];
}

export function toStrip(rows: { week_start: string; mood: number | null; workload?: string | null; has_note?: boolean }[], startDay = 1, n = 12) {
  const by = new Map(rows.map((r) => [r.week_start, r]));
  return lastWeeks(n, startDay).map((w) => ({ week_start: w, mood: by.get(w)?.mood ?? null, workload: by.get(w)?.workload ?? null, has_note: by.get(w)?.has_note }));
}

export const asEngine = (rows: PulseRow[]): PulseCheckin[] =>
  rows.map((r) => ({ week_start: r.week_start, mood: r.mood, workload: r.workload, subject_confidence: (r.subject_confidence ?? []).map((c) => ({ subject: c.subject, score: c.score })) }));
