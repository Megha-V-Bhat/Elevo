import { type Derived, missing, ok, round } from "./derived";

export type GradeBand = { min_pct: number; grade: string; points: number };

export type GradingScheme = {
  bands: GradeBand[];
  pass_pct: number;
  mse_weight: number;
  see_weight: number;
  ia_weight: number;
  see_min_pct: number | null;
  max_points: number;
};

export const DEFAULT_SCHEME: GradingScheme = {
  bands: [
    { min_pct: 90, grade: "O", points: 10 },
    { min_pct: 80, grade: "A+", points: 9 },
    { min_pct: 70, grade: "A", points: 8 },
    { min_pct: 60, grade: "B+", points: 7 },
    { min_pct: 55, grade: "B", points: 6 },
    { min_pct: 50, grade: "C", points: 5 },
    { min_pct: 40, grade: "P", points: 4 },
    { min_pct: 0, grade: "F", points: 0 },
  ],
  pass_pct: 40,
  mse_weight: 0.3,
  see_weight: 0.5,
  ia_weight: 0.2,
  see_min_pct: 35,
  max_points: 10,
};

export type IaComponent = { label: string; marks: number | null; max: number | null };

export type SubjectMarks = {
  has_mse: boolean;
  has_see: boolean;
  mse_marks: number | null;
  mse_max: number | null;
  see_marks: number | null;
  see_max: number | null;
  ia: IaComponent[];
};

export function percentage(marks: number | null, max: number | null): Derived<number> {
  if (marks == null) return missing("Marks not entered");
  if (max == null || max <= 0) return missing("Maximum marks not set");
  if (marks < 0 || marks > max) return missing(`Marks ${marks} are outside 0–${max}`);
  return ok(round((marks / max) * 100));
}

export function iaPercentage(ia: IaComponent[]): Derived<number> {
  if (ia.length === 0) return missing("No internal assessment components");
  let got = 0;
  let max = 0;
  for (const c of ia) {
    if (c.marks == null) return missing(`${c.label} marks not entered`);
    if (c.max == null || c.max <= 0) return missing(`${c.label} maximum not set`);
    if (c.marks < 0 || c.marks > c.max) return missing(`${c.label} marks outside 0–${c.max}`);
    got += c.marks;
    max += c.max;
  }
  return ok(round((got / max) * 100));
}

type Component = { key: "mse" | "see" | "ia"; weight: number; pct: Derived<number> };

function applicableComponents(s: SubjectMarks, scheme: GradingScheme): Component[] {
  const out: Component[] = [];
  if (s.has_mse && scheme.mse_weight > 0)
    out.push({ key: "mse", weight: scheme.mse_weight, pct: percentage(s.mse_marks, s.mse_max) });
  if (s.has_see && scheme.see_weight > 0)
    out.push({ key: "see", weight: scheme.see_weight, pct: percentage(s.see_marks, s.see_max) });
  if (s.ia.length > 0 && scheme.ia_weight > 0)
    out.push({ key: "ia", weight: scheme.ia_weight, pct: iaPercentage(s.ia) });
  return out;
}

/**
 * Weighted total % across the components this subject actually has.
 * Weights are re-normalised over the applicable components so a subject
 * without IA (or without MSE) is still graded consistently.
 */
export function weightedTotal(s: SubjectMarks, scheme: GradingScheme): Derived<number> {
  const comps = applicableComponents(s, scheme);
  if (comps.length === 0) return missing("Subject has no assessed components");
  const absent = comps.find((c) => c.pct.value == null);
  if (absent) return missing(`${absent.key.toUpperCase()}: ${absent.pct.reason}`);
  const wSum = comps.reduce((a, c) => a + c.weight, 0);
  const total = comps.reduce((a, c) => a + (c.pct.value as number) * c.weight, 0) / wSum;
  return ok(round(total));
}

export function bandFor(pct: number, scheme: GradingScheme): GradeBand {
  const sorted = [...scheme.bands].sort((a, b) => b.min_pct - a.min_pct);
  return sorted.find((b) => pct >= b.min_pct) ?? sorted[sorted.length - 1];
}

export function failBand(scheme: GradingScheme): GradeBand {
  return [...scheme.bands].sort((a, b) => a.points - b.points)[0];
}

export type SubjectGrade = { total_pct: number; grade: string; points: number; passed: boolean; note: string | null };

export function gradeSubject(s: SubjectMarks, scheme: GradingScheme): Derived<SubjectGrade> {
  const total = weightedTotal(s, scheme);
  if (total.value == null) return missing(total.reason);
  if (s.has_see && scheme.see_min_pct != null) {
    const see = percentage(s.see_marks, s.see_max).value as number;
    if (see < scheme.see_min_pct) {
      const f = failBand(scheme);
      return ok({
        total_pct: total.value,
        grade: f.grade,
        points: f.points,
        passed: false,
        note: `SEE ${see}% is below the ${scheme.see_min_pct}% minimum`,
      });
    }
  }
  const band = bandFor(total.value, scheme);
  const passed = total.value >= scheme.pass_pct && band.points > 0;
  return ok({ total_pct: total.value, grade: band.grade, points: band.points, passed, note: null });
}

export type CreditPoints = { credits: number | null; points: number | null; label?: string };

/** SGPA = Σ(credits × points) / Σ credits — only when every subject has both. */
export function sgpa(subjects: CreditPoints[]): Derived<number> {
  if (subjects.length === 0) return missing("No subjects recorded");
  const noCredits = subjects.filter((s) => s.credits == null).length;
  const noPoints = subjects.filter((s) => s.points == null).length;
  if (noCredits) return missing(`${noCredits} subject${noCredits > 1 ? "s" : ""} missing credits`);
  if (noPoints) return missing(`${noPoints} subject${noPoints > 1 ? "s" : ""} missing grade points`);
  const credits = subjects.reduce((a, s) => a + (s.credits as number), 0);
  if (credits <= 0) return missing("Total credits are zero");
  const pts = subjects.reduce((a, s) => a + (s.credits as number) * (s.points as number), 0);
  return ok(round(pts / credits));
}

export type CgpaEntry = { subject_key: string; semester_no: number; credits: number | null; points: number | null };

/**
 * CGPA across complete semesters, credit-weighted. A re-registered subject
 * counts once, using its latest attempt. Failed subjects count with 0 points
 * until cleared.
 */
export function cgpa(entries: CgpaEntry[]): Derived<{ cgpa: number; credits: number; points: number }> {
  if (entries.length === 0) return missing("No completed semesters");
  const latest = new Map<string, CgpaEntry>();
  for (const e of entries) {
    const prev = latest.get(e.subject_key);
    if (!prev || e.semester_no >= prev.semester_no) latest.set(e.subject_key, e);
  }
  const rows = [...latest.values()];
  const s = sgpa(rows);
  if (s.value == null) return missing(s.reason);
  const credits = rows.reduce((a, r) => a + (r.credits as number), 0);
  const points = rows.reduce((a, r) => a + (r.credits as number) * (r.points as number), 0);
  return ok({ cgpa: round(points / credits), credits, points: round(points) });
}

/** Human-readable explanation used in the grading-scheme live preview. */
export function explain(s: SubjectMarks, scheme: GradingScheme): string {
  const g = gradeSubject(s, scheme);
  if (g.value == null) return `Not enough data: ${g.reason}`;
  const parts: string[] = [];
  if (s.has_mse) parts.push(`${s.mse_marks}/${s.mse_max} MSE`);
  if (s.ia.length) parts.push(`IA ${iaPercentage(s.ia).value}%`);
  if (s.has_see) parts.push(`${s.see_marks}/${s.see_max} SEE`);
  return `${parts.join(" + ")} → ${g.value.total_pct}% → ${g.value.grade} → ${g.value.points} points${g.value.note ? ` (${g.value.note})` : ""}`;
}
