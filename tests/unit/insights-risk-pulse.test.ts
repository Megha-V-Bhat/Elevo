import { describe, expect, it } from "vitest";
import { buildInsights } from "@/lib/engine/insights";
import { assessRisk } from "@/lib/engine/risk";
import { pulseSignals, reflectionLine, weekStart, type PulseCheckin } from "@/lib/engine/pulse";

describe("insights", () => {
  it("strength needs two comparable assessments ≥ 75%", () => {
    const r = buildInsights([{ semester_no: 3, subject: "DBMS", mse_pct: 80, see_pct: 82, total_pct: 81 }], []);
    expect(r.insights.map((i) => i.type)).toEqual(["STRENGTH"]);
    expect(r.insights[0].evidence[0]).toMatch(/80% and SEE 82%/);
  });
  it("a single high score is not a strength", () => {
    const r = buildInsights([{ semester_no: 3, subject: "DBMS", mse_pct: 90, see_pct: null, total_pct: null }], []);
    expect(r.insights).toHaveLength(0);
    expect(r.notEnoughData[0]).toMatch(/can't be compared/);
  });
  it("MSE→SEE drop is a decline + focus in latest semester", () => {
    const r = buildInsights([{ semester_no: 4, subject: "OS", mse_pct: 70, see_pct: 55, total_pct: 60 }], []);
    expect(r.insights.map((i) => i.type)).toEqual(["DECLINED", "SUGGESTED_FOCUS"]);
  });
  it("missing data never labels weak", () => {
    const r = buildInsights([{ semester_no: 4, subject: "OS", mse_pct: null, see_pct: null, total_pct: null }], []);
    expect(r.insights).toHaveLength(0);
    expect(r.notEnoughData).toEqual(["OS: no marks recorded yet"]);
  });
  it("SGPA drop and rise", () => {
    const r = buildInsights([], [
      { semester_no: 1, sgpa: 8.2 },
      { semester_no: 2, sgpa: 7.5 },
      { semester_no: 3, sgpa: 8.1 },
    ]);
    expect(r.insights.map((i) => i.ruleId)).toEqual(["sgpa-drop", "sgpa-rise"]);
  });
  it("missing SGPA is reported, not compared", () => {
    const r = buildInsights([], [
      { semester_no: 1, sgpa: 8.2 },
      { semester_no: 2, sgpa: null },
    ]);
    expect(r.insights).toHaveLength(0);
    expect(r.notEnoughData[0]).toMatch(/SGPA missing/);
  });
  it("low total = needs attention", () => {
    const r = buildInsights([{ semester_no: 2, subject: "Maths", mse_pct: 45, see_pct: 40, total_pct: 42 }], []);
    expect(r.insights.find((i) => i.type === "NEEDS_ATTENTION")).toBeTruthy();
  });
  it("custom thresholds", () => {
    const r = buildInsights([{ semester_no: 2, subject: "X", mse_pct: 70, see_pct: 71, total_pct: 70 }], [], {
      strong_pct: 70,
      decline_pts: 10,
      sgpa_change: 0.5,
      needs_attention_pct: 50,
    });
    expect(r.insights[0].type).toBe("STRENGTH");
  });
});

describe("risk", () => {
  const base = {
    insights: [],
    current_semester: 5,
    has_current_semester_results: true,
    failed_subjects: [],
    assessment_pcts: [],
    profile_completion: 100,
    profile_incomplete_since_days: null,
  };
  it("no flags when healthy", () => expect(assessRisk(base)).toEqual([]));
  it("every flag has a reason", () => {
    const flags = assessRisk({
      ...base,
      has_current_semester_results: false,
      failed_subjects: ["Maths"],
      assessment_pcts: [
        { subject: "Maths", label: "MSE", pct: 30 },
        { subject: "Physics", label: "SEE", pct: 35 },
      ],
      profile_completion: 60,
      profile_incomplete_since_days: 20,
      insights: [{ type: "DECLINED", ruleId: "sgpa-drop", message: "", evidence: ["Sem 3 8 → Sem 4 7"] }],
    });
    expect(flags.map((f) => f.ruleId)).toEqual(["declining", "missing-results", "repeated-low", "fail", "profile-incomplete"]);
    expect(flags.every((f) => f.reason.length > 0)).toBe(true);
  });
  it("one low mark is not repeated", () =>
    expect(assessRisk({ ...base, assessment_pcts: [{ subject: "M", label: "MSE", pct: 20 }] })).toEqual([]));
  it("incomplete profile within grace period", () =>
    expect(assessRisk({ ...base, profile_completion: 50, profile_incomplete_since_days: 5 })).toEqual([]));
});

describe("pulse", () => {
  const c = (week: string, mood: number, workload: PulseCheckin["workload"] = "OKAY", conf: PulseCheckin["subject_confidence"] = []) => ({
    week_start: week,
    mood,
    workload,
    subject_confidence: conf,
  });
  it("3 consecutive low weeks → signal, self-reported", () => {
    const s = pulseSignals([c("2026-09-28", 2), c("2026-10-05", 1), c("2026-10-12", 2)]);
    expect(s).toHaveLength(1);
    expect(s[0].selfReported).toBe(true);
  });
  it("a skipped week breaks the streak and is never a signal", () =>
    expect(pulseSignals([c("2026-09-21", 1), c("2026-09-28", 2), c("2026-10-12", 1)])).toEqual([]));
  it("no check-ins → no signal", () => expect(pulseSignals([])).toEqual([]));
  it("heavy + low confidence same subject 2 weeks", () => {
    const s = pulseSignals([
      c("2026-10-05", 3, "HEAVY", [{ subject: "DBMS", score: 2 }]),
      c("2026-10-12", 3, "HEAVY", [{ subject: "DBMS", score: 1 }, { subject: "OS", score: 1 }]),
    ]);
    expect(s.map((x) => x.label)).toEqual(["Heavy workload + low confidence in DBMS"]);
  });
  it("reflection needs 3 weeks", () => expect(reflectionLine([c("2026-10-05", 3)])).toBeNull());
  it("reflection mentions heavy weeks", () =>
    expect(reflectionLine([c("2026-10-05", 3, "HEAVY"), c("2026-10-12", 3, "HEAVY"), c("2026-10-19", 3)])).toMatch(/heavy/));
  it("weekStart is Monday by default", () => expect(weekStart(new Date("2026-10-29T10:00:00Z"))).toBe("2026-10-26"));
  it("weekStart honours configured day", () => expect(weekStart(new Date("2026-10-29T10:00:00Z"), 0)).toBe("2026-10-25"));
});
