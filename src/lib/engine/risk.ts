import type { Insight } from "./insights";

export type RiskFlag = { ruleId: string; label: string; reason: string };

export type RiskThresholds = {
  low_pct: number;
  low_count: number;
  profile_incomplete_days: number;
};

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = { low_pct: 40, low_count: 2, profile_incomplete_days: 14 };

export type RiskInput = {
  insights: Insight[];
  current_semester: number | null;
  has_current_semester_results: boolean;
  failed_subjects: string[];
  assessment_pcts: { subject: string; label: string; pct: number }[];
  profile_completion: number;
  profile_incomplete_since_days: number | null;
};

/** Mentor/HOD-only risk flags. Every flag carries an explicit reason; there is no opaque score. */
export function assessRisk(i: RiskInput, t: RiskThresholds = DEFAULT_RISK_THRESHOLDS): RiskFlag[] {
  const flags: RiskFlag[] = [];

  const declines = i.insights.filter((x) => x.type === "DECLINED");
  if (declines.length) {
    flags.push({
      ruleId: "declining",
      label: "Declining performance",
      reason: declines.flatMap((d) => d.evidence).join("; "),
    });
  }

  if (i.current_semester != null && !i.has_current_semester_results) {
    flags.push({
      ruleId: "missing-results",
      label: "Missing results",
      reason: `No results recorded for semester ${i.current_semester}`,
    });
  }

  const low = i.assessment_pcts.filter((a) => a.pct < t.low_pct);
  if (low.length >= t.low_count) {
    flags.push({
      ruleId: "repeated-low",
      label: "Repeated low marks",
      reason: `${low.length} assessments below ${t.low_pct}%: ${low
        .slice(0, 4)
        .map((a) => `${a.subject} ${a.label} ${a.pct}%`)
        .join(", ")}`,
    });
  }

  if (i.failed_subjects.length) {
    flags.push({ ruleId: "fail", label: "Failed subject", reason: `Result FAIL in ${i.failed_subjects.join(", ")}` });
  }

  if (
    i.profile_completion < 100 &&
    i.profile_incomplete_since_days != null &&
    i.profile_incomplete_since_days > t.profile_incomplete_days
  ) {
    flags.push({
      ruleId: "profile-incomplete",
      label: "Profile incomplete",
      reason: `Profile ${i.profile_completion}% complete for ${i.profile_incomplete_since_days} days`,
    });
  }

  return flags;
}
