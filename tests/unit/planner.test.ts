import { describe, expect, it } from "vitest";
import { planCgpa, planSubject, solveScenario } from "@/lib/engine/planner";
import { DEFAULT_SCHEME } from "@/lib/engine/grading";

const cg = { earned_credits: 80, current_points: 640, best_sgpa: 8.6, max_points: 10 }; // CGPA 8.0

describe("planCgpa", () => {
  it("spec example: 8.5 over 2 semesters", () => {
    const r = planCgpa({ ...cg, target: 8.5, remaining_credits: 40 }).value!;
    // (8.5*120 - 640)/40 = 9.5
    expect(r.required_avg_sgpa).toBe(9.5);
    expect(r.state).toBe("STRETCH");
    expect(r.current_cgpa).toBe(8);
  });
  it("comfortable when below current CGPA", () =>
    expect(planCgpa({ ...cg, target: 7.8, remaining_credits: 40 }).value!.state).toBe("COMFORTABLE"));
  it("on track when within best SGPA", () =>
    expect(planCgpa({ ...cg, target: 8.2, remaining_credits: 40 }).value!.state).toBe("ON_TRACK"));
  it("not reachable above max points", () =>
    expect(planCgpa({ ...cg, target: 9.9, remaining_credits: 20 }).value!.state).toBe("NOT_REACHABLE"));
  it("already achieved when required ≤ 0", () => {
    const r = planCgpa({ ...cg, earned_credits: 180, current_points: 1800, target: 2, remaining_credits: 4 }).value!;
    expect(r.state).toBe("ACHIEVED");
    expect(r.required_avg_sgpa).toBe(0);
  });
  it("unknown remaining credits", () =>
    expect(planCgpa({ ...cg, target: 8.5, remaining_credits: null }).reason).toMatch(/unknown/));
  it("no remaining credits", () => expect(planCgpa({ ...cg, target: 8.5, remaining_credits: 0 }).value).toBeNull());
  it("target above max", () => expect(planCgpa({ ...cg, target: 11, remaining_credits: 40 }).value).toBeNull());
  it("first-semester student (no history)", () => {
    const r = planCgpa({ earned_credits: 0, current_points: 0, best_sgpa: null, max_points: 10, target: 8, remaining_credits: 160 }).value!;
    expect(r.required_avg_sgpa).toBe(8);
    expect(r.state).toBe("STRETCH");
  });
});

describe("solveScenario", () => {
  const base = { earned_credits: 80, current_points: 640, target: 8.5, max_points: 10 };
  it("free semesters share the requirement", () => {
    const r = solveScenario(base, [
      { label: "Sem 5", credits: 20, sgpa: null },
      { label: "Sem 6", credits: 20, sgpa: null },
    ]).value!;
    expect(r.free_sgpa).toBe(9.5);
    expect(r.projected_cgpa).toBe(8.5);
  });
  it("fixing one semester rebalances the other", () => {
    const r = solveScenario(base, [
      { label: "Sem 5", credits: 20, sgpa: 9 },
      { label: "Sem 6", credits: 20, sgpa: null },
    ]).value!;
    expect(r.free_sgpa).toBe(10);
    expect(r.reachable).toBe(true);
  });
  it("all fixed → projection", () => {
    const r = solveScenario(base, [{ label: "Sem 5", credits: 20, sgpa: 8 }]).value!;
    expect(r.free_sgpa).toBeNull();
    expect(r.projected_cgpa).toBe(8);
    expect(r.reachable).toBe(false);
  });
  it("unreachable flagged", () =>
    expect(
      solveScenario(base, [
        { label: "Sem 5", credits: 20, sgpa: 6 },
        { label: "Sem 6", credits: 20, sgpa: null },
      ]).value!.reachable,
    ).toBe(false));
  it("missing credits", () => expect(solveScenario(base, [{ label: "x", credits: 0, sgpa: null }]).value).toBeNull());
});

describe("planSubject", () => {
  const scheme = { ...DEFAULT_SCHEME, mse_weight: 0.4, see_weight: 0.6, ia_weight: 0, see_min_pct: 35 };
  const input = { scheme, target_grade: "A", has_mse: true, mse_marks: 32, mse_max: 50, ia: [], see_max: 100 };
  it("minimum SEE for an A", () => {
    const r = planSubject(input).value!;
    // need 0.4*64 + 0.6*x ≥ 70 → x ≥ 74
    expect(r.min_see_marks).toBe(74);
    expect(r.state).toBe("REACHABLE");
    expect(r.steps.at(-1)).toMatch(/→ A$/);
  });
  it("not reachable above SEE max", () =>
    expect(planSubject({ ...input, target_grade: "O", mse_marks: 10 }).value!.state).toBe("NOT_REACHABLE"));
  it("SEE minimum is a floor", () => {
    const r = planSubject({ ...input, target_grade: "P", mse_marks: 50 }).value!;
    expect(r.min_see_marks).toBe(35);
    expect(r.state).toBe("SECURED");
  });
  it("includes IA", () => {
    const s = { ...DEFAULT_SCHEME, see_min_pct: null };
    const r = planSubject({ ...input, scheme: s, ia: [{ label: "IA", marks: 20, max: 20 }] }).value!;
    // (0.3*64 + 0.2*100 + 0.5x) ≥ 70 → x ≥ 61.6 → 62
    expect(r.min_see_marks).toBe(62);
  });
  it("missing MSE → named reason", () => expect(planSubject({ ...input, mse_marks: null }).reason).toMatch(/MSE/));
  it("missing SEE max", () => expect(planSubject({ ...input, see_max: null }).reason).toMatch(/SEE maximum/));
  it("unknown grade", () => expect(planSubject({ ...input, target_grade: "Z" }).value).toBeNull());
  it("SEE has no weight", () =>
    expect(planSubject({ ...input, scheme: { ...scheme, see_weight: 0 } }).reason).toMatch(/no weight/));
});
