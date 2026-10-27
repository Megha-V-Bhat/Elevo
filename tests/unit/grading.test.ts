import { describe, expect, it } from "vitest";
import {
  cgpa,
  DEFAULT_SCHEME,
  explain,
  gradeSubject,
  iaPercentage,
  percentage,
  sgpa,
  type SubjectMarks,
  weightedTotal,
} from "@/lib/engine/grading";

const base: SubjectMarks = {
  has_mse: true,
  has_see: true,
  mse_marks: 38,
  mse_max: 50,
  see_marks: 61,
  see_max: 100,
  ia: [],
};
const noIa = { ...DEFAULT_SCHEME, ia_weight: 0, mse_weight: 0.4, see_weight: 0.6 };

describe("percentage", () => {
  it("computes when max exists", () => expect(percentage(38, 50).value).toBe(76));
  it("refuses missing marks", () => expect(percentage(null, 50).reason).toMatch(/not entered/));
  it("refuses missing max", () => expect(percentage(10, null).reason).toMatch(/Maximum/));
  it("refuses zero max", () => expect(percentage(0, 0).value).toBeNull());
  it("refuses marks above max", () => expect(percentage(51, 50).reason).toMatch(/outside/));
  it("refuses negative marks", () => expect(percentage(-1, 50).value).toBeNull());
});

describe("iaPercentage", () => {
  it("sums components", () =>
    expect(iaPercentage([{ label: "Quiz", marks: 8, max: 10 }, { label: "Lab", marks: 12, max: 15 }]).value).toBe(80));
  it("needs every component", () =>
    expect(iaPercentage([{ label: "Quiz", marks: null, max: 10 }]).reason).toMatch(/Quiz/));
  it("empty = not enough data", () => expect(iaPercentage([]).value).toBeNull());
});

describe("weightedTotal", () => {
  it("weights MSE and SEE", () => expect(weightedTotal(base, noIa).value).toBe(67.0));
  it("renormalises when a subject has no IA", () =>
    // 0.3*76 + 0.5*61 over 0.8
    expect(weightedTotal(base, DEFAULT_SCHEME).value).toBeCloseTo(66.63, 1));
  it("includes IA when present", () => {
    const s = { ...base, ia: [{ label: "IA", marks: 18, max: 20 }] };
    expect(weightedTotal(s, DEFAULT_SCHEME).value).toBeCloseTo(0.3 * 76 + 0.5 * 61 + 0.2 * 90, 1);
  });
  it("SEE-only subject", () =>
    expect(weightedTotal({ ...base, has_mse: false }, DEFAULT_SCHEME).value).toBe(61));
  it("missing SEE → reason", () => expect(weightedTotal({ ...base, see_marks: null }, noIa).reason).toMatch(/SEE/));
  it("no components → reason", () =>
    expect(weightedTotal({ ...base, has_mse: false, has_see: false }, noIa).value).toBeNull());
});

describe("gradeSubject", () => {
  it("maps to band", () => {
    const g = gradeSubject(base, noIa).value!;
    expect(g.grade).toBe("B+");
    expect(g.points).toBe(7);
    expect(g.passed).toBe(true);
  });
  it("SEE below minimum fails regardless of total", () => {
    const g = gradeSubject({ ...base, mse_marks: 50, see_marks: 30 }, noIa).value!;
    expect(g.grade).toBe("F");
    expect(g.points).toBe(0);
    expect(g.note).toMatch(/minimum/);
  });
  it("below pass is a fail", () => {
    const g = gradeSubject({ ...base, mse_marks: 10, see_marks: 36 }, noIa).value!;
    expect(g.passed).toBe(false);
  });
  it("top band", () => expect(gradeSubject({ ...base, mse_marks: 50, see_marks: 100 }, noIa).value!.grade).toBe("O"));
  it("explain() reads like the spec preview", () =>
    expect(explain(base, noIa)).toBe("38/50 MSE + 61/100 SEE → 67% → B+ → 7 points"));
  it("explain() for missing data", () => expect(explain({ ...base, see_marks: null }, noIa)).toMatch(/^Not enough data/));
});

describe("sgpa", () => {
  it("credit-weighted", () =>
    expect(sgpa([{ credits: 4, points: 9 }, { credits: 3, points: 7 }, { credits: 1, points: 10 }]).value).toBe(8.38));
  it("missing credits", () => expect(sgpa([{ credits: null, points: 9 }]).reason).toMatch(/credits/));
  it("missing points", () =>
    expect(sgpa([{ credits: 3, points: 9 }, { credits: 3, points: null }, { credits: 3, points: null }]).reason).toBe(
      "2 subjects missing grade points",
    ));
  it("zero credits", () => expect(sgpa([{ credits: 0, points: 9 }]).reason).toMatch(/zero/));
  it("empty", () => expect(sgpa([]).value).toBeNull());
  it("failed subject counts with 0 points", () =>
    expect(sgpa([{ credits: 4, points: 0 }, { credits: 4, points: 10 }]).value).toBe(5));
});

describe("cgpa", () => {
  it("across semesters", () => {
    const r = cgpa([
      { subject_key: "A", semester_no: 1, credits: 4, points: 8 },
      { subject_key: "B", semester_no: 2, credits: 4, points: 10 },
    ]).value!;
    expect(r.cgpa).toBe(9);
    expect(r.credits).toBe(8);
  });
  it("re-registered subject uses latest attempt", () => {
    const r = cgpa([
      { subject_key: "A", semester_no: 1, credits: 4, points: 0 },
      { subject_key: "A", semester_no: 3, credits: 4, points: 7 },
      { subject_key: "B", semester_no: 1, credits: 4, points: 9 },
    ]).value!;
    expect(r.cgpa).toBe(8);
    expect(r.credits).toBe(8);
  });
  it("incomplete data → reason", () =>
    expect(cgpa([{ subject_key: "A", semester_no: 1, credits: 4, points: null }]).value).toBeNull());
});
