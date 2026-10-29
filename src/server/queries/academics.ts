import "server-only";
import { cache } from "react";
import { cgpa as cgpaOf, DEFAULT_SCHEME, gradeSubject, type GradingScheme, type IaComponent, percentage, sgpa as sgpaOf } from "@/lib/engine/grading";
import { buildInsights, DEFAULT_INSIGHT_THRESHOLDS, type InsightReport, type InsightThresholds } from "@/lib/engine/insights";
import { assessRisk, DEFAULT_RISK_THRESHOLDS, type RiskFlag, type RiskThresholds } from "@/lib/engine/risk";
import { toNum } from "@/lib/utils";
import { db } from "../supabase";

export type Subject = {
  id: string;
  code: string;
  name: string;
  credits: number | null;
  semester: number | null;
  has_mse: boolean;
  has_see: boolean;
  mse_max: number | null;
  see_max: number | null;
  ia_components: { label: string; max: number }[];
};

export type ResultView = {
  id: string;
  subject: Subject;
  mse_marks: number | null;
  mse_max: number | null;
  see_marks: number | null;
  see_max: number | null;
  ia: IaComponent[];
  grade: string | null;
  grade_points: number | null;
  result: "PASS" | "FAIL" | "PENDING" | "ABSENT";
  credits_earned: number | null;
  mse_pct: number | null;
  see_pct: number | null;
  total_pct: number | null;
  derived_grade: string | null;
  derived_points: number | null;
  derived_note: string | null;
};

export type SemesterView = {
  id: string;
  semester_no: number;
  academic_year: string | null;
  status: "DRAFT" | "SUBMITTED" | "VERIFIED" | "FINALIZED";
  verified_at: string | null;
  results: ResultView[];
  sgpa: number | null;
  sgpa_reason: string | null;
  credits: number | null;
  credits_earned: number;
  stored_note: string | null;
  /** SGPA typed in by the student during setup, not derived from subject marks. */
  manual: boolean;
};

export type Academics = {
  scheme: GradingScheme & { id: string | null; name: string };
  semesters: SemesterView[];
  cgpa: number | null;
  cgpa_reason: string | null;
  earned_credits: number;
  current_points: number;
  best_sgpa: number | null;
  verified_count: number;
};

const SCHEME_COLS = "id, name, bands, pass_pct, mse_weight, see_weight, ia_weight, see_min_pct, max_points";

export function toScheme(r: Record<string, unknown> | null): Academics["scheme"] {
  if (!r) return { ...DEFAULT_SCHEME, id: null, name: "Default 10-point" };
  return {
    id: r.id as string,
    name: r.name as string,
    bands: r.bands as GradingScheme["bands"],
    pass_pct: Number(r.pass_pct),
    mse_weight: Number(r.mse_weight),
    see_weight: Number(r.see_weight),
    ia_weight: Number(r.ia_weight),
    see_min_pct: toNum(r.see_min_pct),
    max_points: Number(r.max_points),
  };
}

export const activeScheme = cache(async (departmentId: string | null) => {
  const supabase = await db();
  let q = supabase.from("grading_schemes").select(SCHEME_COLS).eq("active", true);
  if (departmentId) q = q.eq("department_id", departmentId);
  const { data } = await q.limit(1).maybeSingle();
  return toScheme(data);
});

const SUBJECT_COLS = "id, code, name, credits, semester, has_mse, has_see, mse_max, see_max, ia_components";
export const toSubject = (s: Record<string, unknown>): Subject => ({
  id: s.id as string,
  code: s.code as string,
  name: s.name as string,
  credits: toNum(s.credits),
  semester: toNum(s.semester),
  has_mse: Boolean(s.has_mse),
  has_see: Boolean(s.has_see),
  mse_max: toNum(s.mse_max),
  see_max: toNum(s.see_max),
  ia_components: (s.ia_components as Subject["ia_components"]) ?? [],
});

const SEM_SELECT = `id, student_id, semester_no, academic_year, status, verified_at,
  semester_summaries ( sgpa, computed, computation_note, credits_registered ),
  student_subject_results ( id, mse_marks, mse_max, see_marks, see_max, ia, grade, grade_points, result, credits_earned,
    subjects ( ${SUBJECT_COLS} ) )`;

/** Every semester for a student with derived values. RLS decides whether the caller may see it. */
export const loadAcademics = cache(async (studentId: string, departmentId: string | null): Promise<Academics> => {
  const supabase = await db();
  const [scheme, semRes] = await Promise.all([activeScheme(departmentId), supabase.from("academic_semesters").select(SEM_SELECT).eq("student_id", studentId).order("semester_no")]);
  return buildAcademics((semRes.data ?? []) as Record<string, unknown>[], scheme);
});

/** One query for many students (directories, rosters, analytics). */
export async function loadAcademicsBulk(studentIds: string[], departmentId: string | null): Promise<Map<string, Academics>> {
  const out = new Map<string, Academics>();
  if (!studentIds.length) return out;
  const supabase = await db();
  const chunks: string[][] = [];
  for (let k = 0; k < studentIds.length; k += 150) chunks.push(studentIds.slice(k, k + 150));
  const [scheme, results] = await Promise.all([
    activeScheme(departmentId),
    Promise.all(chunks.map((ids) => supabase.from("academic_semesters").select(SEM_SELECT).in("student_id", ids).order("semester_no"))),
  ]);
  const rows = results.flatMap(({ data }) => (data ?? []) as Record<string, unknown>[]);
  for (const id of studentIds) out.set(id, buildAcademics(rows.filter((r) => r.student_id === id), scheme));
  return out;
}

export function buildAcademics(rows: Record<string, unknown>[], scheme: Academics["scheme"]): Academics {

  const semesters: SemesterView[] = rows.map((s) => {
    const results: ResultView[] = ((s.student_subject_results as Record<string, unknown>[]) ?? []).map((r) => {
      const subject = toSubject(r.subjects as Record<string, unknown>);
      const marks = {
        has_mse: subject.has_mse,
        has_see: subject.has_see,
        mse_marks: toNum(r.mse_marks),
        mse_max: toNum(r.mse_max) ?? subject.mse_max,
        see_marks: toNum(r.see_marks),
        see_max: toNum(r.see_max) ?? subject.see_max,
        ia: ((r.ia as IaComponent[]) ?? []).map((c) => ({ label: c.label, marks: toNum(c.marks), max: toNum(c.max) })),
      };
      const g = gradeSubject(marks, scheme);
      return {
        id: r.id as string,
        subject,
        ...marks,
        grade: (r.grade as string) ?? null,
        grade_points: toNum(r.grade_points),
        result: r.result as ResultView["result"],
        credits_earned: toNum(r.credits_earned),
        mse_pct: subject.has_mse ? percentage(marks.mse_marks, marks.mse_max).value : null,
        see_pct: subject.has_see ? percentage(marks.see_marks, marks.see_max).value : null,
        total_pct: g.value?.total_pct ?? null,
        derived_grade: g.value?.grade ?? null,
        derived_points: g.value?.points ?? null,
        derived_note: g.value?.note ?? g.reason,
      };
    });
    results.sort((a, b) => a.subject.code.localeCompare(b.subject.code));
    // Recorded grade points win (official result); otherwise use the derived grade.
    const cp = results.map((r) => ({ credits: r.subject.credits, points: r.grade_points ?? r.derived_points }));
    const s1 = sgpaOf(cp);
    const summary = (Array.isArray(s.semester_summaries) ? s.semester_summaries[0] : s.semester_summaries) as Record<string, unknown> | null;
    const manual = Boolean(summary && !summary.computed && results.length === 0 && summary.sgpa != null);
    const storedSgpa = summary && (summary.computed || manual) ? toNum(summary.sgpa) : null;
    const credits = manual
      ? toNum(summary?.credits_registered)
      : results.length && results.every((r) => r.subject.credits != null)
        ? results.reduce((a, r) => a + (r.subject.credits ?? 0), 0)
        : null;
    return {
      id: s.id as string,
      semester_no: Number(s.semester_no),
      academic_year: (s.academic_year as string) ?? null,
      status: s.status as SemesterView["status"],
      verified_at: (s.verified_at as string) ?? null,
      results,
      sgpa: storedSgpa ?? s1.value,
      sgpa_reason: storedSgpa != null ? null : s1.reason,
      credits,
      credits_earned: results.filter((r) => r.result === "PASS" || (r.grade_points ?? r.derived_points ?? 0) > 0).reduce((a, r) => a + (r.subject.credits ?? 0), 0),
      stored_note: (summary?.computation_note as string) ?? null,
      manual,
    };
  });

  const complete = semesters.filter((s) => s.sgpa != null && s.results.length);
  const cg = cgpaOf(
    complete.flatMap((s) =>
      s.results.map((r) => ({ subject_key: r.subject.code, semester_no: s.semester_no, credits: r.subject.credits, points: r.grade_points ?? r.derived_points })),
    ),
  );
  // Manually entered semesters (setup) contribute credits × SGPA when credits are known.
  const manual = semesters.filter((s) => s.manual && s.sgpa != null && s.credits);
  let credits = cg.value?.credits ?? 0;
  let points = cg.value?.points ?? 0;
  for (const s of manual) {
    credits += s.credits as number;
    points += (s.credits as number) * (s.sgpa as number);
  }
  const cgpaValue = credits > 0 && (cg.value || manual.length) ? Math.round((points / credits) * 100) / 100 : null;
  const withSgpa = semesters.filter((s) => s.sgpa != null);
  return {
    scheme,
    semesters,
    cgpa: cgpaValue,
    cgpa_reason: cgpaValue == null ? (cg.reason ?? "No completed semesters") : null,
    earned_credits: credits,
    current_points: Math.round(points * 100) / 100,
    best_sgpa: withSgpa.length ? Math.max(...withSgpa.map((s) => s.sgpa as number)) : null,
    verified_count: semesters.filter((s) => s.status === "VERIFIED" || s.status === "FINALIZED").length,
  };
}

export async function thresholds(departmentId: string | null): Promise<{ insight: InsightThresholds; risk: RiskThresholds }> {
  const supabase = await db();
  let q = supabase.from("risk_thresholds").select("rule_key, value");
  if (departmentId) q = q.eq("department_id", departmentId);
  const { data } = await q;
  const m = Object.fromEntries((data ?? []).map((r) => [r.rule_key, Number((r.value as { v: number })?.v ?? r.value)]));
  return {
    insight: {
      strong_pct: m.strong_pct ?? DEFAULT_INSIGHT_THRESHOLDS.strong_pct,
      decline_pts: m.decline_pts ?? DEFAULT_INSIGHT_THRESHOLDS.decline_pts,
      sgpa_change: m.sgpa_change ?? DEFAULT_INSIGHT_THRESHOLDS.sgpa_change,
      needs_attention_pct: m.needs_attention_pct ?? DEFAULT_INSIGHT_THRESHOLDS.needs_attention_pct,
    },
    risk: {
      low_pct: m.low_pct ?? DEFAULT_RISK_THRESHOLDS.low_pct,
      low_count: m.low_count ?? DEFAULT_RISK_THRESHOLDS.low_count,
      profile_incomplete_days: m.profile_incomplete_days ?? DEFAULT_RISK_THRESHOLDS.profile_incomplete_days,
    },
  };
}

export function insightsFrom(a: Academics, t: InsightThresholds, filter?: { semester?: number }): InsightReport {
  const sems = filter?.semester ? a.semesters.filter((s) => s.semester_no === filter.semester) : a.semesters;
  return buildInsights(
    sems.flatMap((s) => s.results.map((r) => ({ semester_no: s.semester_no, subject: r.subject.name, mse_pct: r.mse_pct, see_pct: r.see_pct, total_pct: r.total_pct }))),
    a.semesters.map((s) => ({ semester_no: s.semester_no, sgpa: s.sgpa })),
    t,
  );
}

export function riskFrom(
  a: Academics,
  report: InsightReport,
  profile: { current_semester: number | null; profile_completion: number; created_at: string | null },
  t: RiskThresholds,
): RiskFlag[] {
  const days = profile.created_at ? Math.floor((Date.now() - Date.parse(profile.created_at)) / 86_400_000) : null;
  return assessRisk(
    {
      insights: report.insights,
      current_semester: profile.current_semester,
      has_current_semester_results: profile.current_semester == null || a.semesters.some((s) => s.semester_no === profile.current_semester && s.results.length > 0),
      failed_subjects: a.semesters.flatMap((s) => s.results.filter((r) => r.result === "FAIL").map((r) => r.subject.name)),
      assessment_pcts: a.semesters.flatMap((s) =>
        s.results.flatMap((r) => [
          ...(r.mse_pct != null ? [{ subject: r.subject.name, label: "MSE", pct: r.mse_pct }] : []),
          ...(r.see_pct != null ? [{ subject: r.subject.name, label: "SEE", pct: r.see_pct }] : []),
        ]),
      ),
      profile_completion: profile.profile_completion,
      profile_incomplete_since_days: days,
    },
    t,
  );
}

export async function subjectCatalog(departmentId: string | null, semester?: number) {
  const supabase = await db();
  let q = supabase.from("subjects").select(SUBJECT_COLS).order("semester").order("code");
  if (departmentId) q = q.eq("department_id", departmentId);
  if (semester) q = q.eq("semester", semester);
  const { data } = await q.limit(500);
  return (data ?? []).map(toSubject);
}
