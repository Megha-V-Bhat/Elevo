import { type Derived, missing, ok, round } from "./derived";
import { bandFor, type GradingScheme, iaPercentage, percentage, type IaComponent } from "./grading";

export type Feasibility = "ACHIEVED" | "COMFORTABLE" | "ON_TRACK" | "STRETCH" | "NOT_REACHABLE";

export type CgpaPlanInput = {
  target: number;
  earned_credits: number;
  current_points: number; // Σ credits × grade points so far
  remaining_credits: number | null;
  best_sgpa: number | null;
  max_points: number;
};

export type CgpaPlanResult = {
  required_avg_sgpa: number;
  current_cgpa: number | null;
  state: Feasibility;
  message: string;
};

export function planCgpa(i: CgpaPlanInput): Derived<CgpaPlanResult> {
  if (!(i.target > 0)) return missing("Choose a target CGPA");
  if (i.target > i.max_points) return missing(`Target can't exceed ${i.max_points}`);
  if (i.remaining_credits == null) return missing("Remaining credits are unknown");
  if (i.remaining_credits <= 0) return missing("No remaining credits to plan for");
  const current = i.earned_credits > 0 ? round(i.current_points / i.earned_credits) : null;
  const raw = (i.target * (i.earned_credits + i.remaining_credits) - i.current_points) / i.remaining_credits;
  const required = round(raw);
  let state: Feasibility;
  if (raw <= 0) state = "ACHIEVED";
  else if (current != null && raw <= current) state = "COMFORTABLE";
  else if (i.best_sgpa != null && raw <= i.best_sgpa) state = "ON_TRACK";
  else if (raw <= i.max_points) state = "STRETCH";
  else state = "NOT_REACHABLE";
  return ok({ required_avg_sgpa: Math.max(0, required), current_cgpa: current, state, message: feasibilityMessage(state, required) });
}

export function feasibilityMessage(state: Feasibility, required: number): string {
  switch (state) {
    case "ACHIEVED":
      return "You've already secured this target. Keep it steady.";
    case "COMFORTABLE":
      return `An average SGPA of ${required} keeps you there — below your current CGPA.`;
    case "ON_TRACK":
      return `An average SGPA of ${required} is within what you've already achieved.`;
    case "STRETCH":
      return `You'd need ${required} on average — higher than your best so far. This one is a stretch. Talk it through with your mentor?`;
    case "NOT_REACHABLE":
      return "This target isn't reachable with the remaining credits. Try a nearer milestone first.";
  }
}

export type ScenarioSemester = { label: string; credits: number; sgpa: number | null };

/**
 * Scenario sliders: semesters with a chosen SGPA are fixed; the rest share the
 * remaining requirement equally so the plan always lands on the target.
 */
export function solveScenario(
  base: { earned_credits: number; current_points: number; target: number; max_points: number },
  semesters: ScenarioSemester[],
): Derived<{ free_sgpa: number | null; projected_cgpa: number; reachable: boolean }> {
  if (semesters.length === 0) return missing("No remaining semesters");
  if (semesters.some((s) => !(s.credits > 0))) return missing("Every remaining semester needs credits");
  const totalCredits = base.earned_credits + semesters.reduce((a, s) => a + s.credits, 0);
  const fixed = semesters.filter((s) => s.sgpa != null);
  const free = semesters.filter((s) => s.sgpa == null);
  const fixedPoints = fixed.reduce((a, s) => a + s.credits * (s.sgpa as number), 0);
  if (free.length === 0) {
    const projected = round((base.current_points + fixedPoints) / totalCredits);
    return ok({ free_sgpa: null, projected_cgpa: projected, reachable: projected >= base.target });
  }
  const freeCredits = free.reduce((a, s) => a + s.credits, 0);
  const need = (base.target * totalCredits - base.current_points - fixedPoints) / freeCredits;
  const clamped = Math.min(Math.max(need, 0), base.max_points);
  const projected = round((base.current_points + fixedPoints + clamped * freeCredits) / totalCredits);
  return ok({ free_sgpa: round(Math.max(need, 0)), projected_cgpa: projected, reachable: need <= base.max_points });
}

export type SubjectPlanInput = {
  scheme: GradingScheme;
  target_grade: string;
  has_mse: boolean;
  mse_marks: number | null;
  mse_max: number | null;
  ia: IaComponent[];
  see_max: number | null;
};

export type SubjectPlanResult = {
  min_see_marks: number;
  see_max: number;
  required_see_pct: number;
  state: "SECURED" | "REACHABLE" | "NOT_REACHABLE";
  steps: string[];
};

/** Minimum SEE marks for a target grade given MSE/IA already recorded. */
export function planSubject(i: SubjectPlanInput): Derived<SubjectPlanResult> {
  const band = i.scheme.bands.find((b) => b.grade === i.target_grade);
  if (!band) return missing("Choose a target grade");
  if (i.see_max == null || i.see_max <= 0) return missing("SEE maximum marks are not set for this subject");
  if (i.scheme.see_weight <= 0) return missing("The grading scheme gives SEE no weight");

  const steps: string[] = [];
  let knownWeighted = 0;
  let wSum = i.scheme.see_weight;
  if (i.has_mse && i.scheme.mse_weight > 0) {
    const m = percentage(i.mse_marks, i.mse_max);
    if (m.value == null) return missing(`MSE: ${m.reason}`);
    knownWeighted += m.value * i.scheme.mse_weight;
    wSum += i.scheme.mse_weight;
    steps.push(`MSE ${i.mse_marks}/${i.mse_max} = ${m.value}% × weight ${i.scheme.mse_weight}`);
  }
  if (i.ia.length > 0 && i.scheme.ia_weight > 0) {
    const ia = iaPercentage(i.ia);
    if (ia.value == null) return missing(`IA: ${ia.reason}`);
    knownWeighted += ia.value * i.scheme.ia_weight;
    wSum += i.scheme.ia_weight;
    steps.push(`IA = ${ia.value}% × weight ${i.scheme.ia_weight}`);
  }
  // total = (known + see% × w_see) / wSum ≥ band.min_pct
  const needPct = (band.min_pct * wSum - knownWeighted) / i.scheme.see_weight;
  const floor = i.scheme.see_min_pct ?? 0;
  const requiredPct = Math.max(needPct, floor, 0);
  steps.push(
    `Target ${band.grade} needs a weighted total ≥ ${band.min_pct}%, so SEE needs ≥ ${round(Math.max(needPct, 0))}%` +
      (floor > 0 ? ` (and at least the ${floor}% SEE minimum)` : ""),
  );
  const minMarks = Math.ceil((requiredPct / 100) * i.see_max - 1e-9);
  steps.push(`${round(requiredPct)}% of ${i.see_max} = ${minMarks} marks`);
  const state = minMarks > i.see_max ? "NOT_REACHABLE" : needPct <= floor ? "SECURED" : "REACHABLE";
  // Sanity: the grade we'd actually get at minMarks
  if (state !== "NOT_REACHABLE") {
    const total = (knownWeighted + (minMarks / i.see_max) * 100 * i.scheme.see_weight) / wSum;
    steps.push(`Check: at ${minMarks}/${i.see_max} your total is ${round(total)}% → ${bandFor(total, i.scheme).grade}`);
  }
  return ok({ min_see_marks: minMarks, see_max: i.see_max, required_see_pct: round(requiredPct), state, steps });
}
