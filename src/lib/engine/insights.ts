export type InsightType = "STRENGTH" | "NEEDS_ATTENTION" | "SUGGESTED_FOCUS" | "IMPROVED" | "DECLINED";

export type Insight = {
  type: InsightType;
  ruleId: string;
  subject?: string;
  message: string;
  evidence: string[];
};

export type SubjectAssessment = {
  semester_no: number;
  subject: string;
  mse_pct: number | null;
  see_pct: number | null;
  total_pct: number | null;
};

export type SemesterSgpa = { semester_no: number; sgpa: number | null };

export type InsightThresholds = {
  strong_pct: number;
  decline_pts: number;
  sgpa_change: number;
  needs_attention_pct: number;
};

export const DEFAULT_INSIGHT_THRESHOLDS: InsightThresholds = {
  strong_pct: 75,
  decline_pts: 10,
  sgpa_change: 0.5,
  needs_attention_pct: 50,
};

export type InsightReport = { insights: Insight[]; notEnoughData: string[] };

/**
 * Transparent rule-based insights. Every insight carries the evidence that
 * produced it; missing or non-comparable data is reported, never penalised.
 */
export function buildInsights(
  subjects: SubjectAssessment[],
  sgpas: SemesterSgpa[],
  t: InsightThresholds = DEFAULT_INSIGHT_THRESHOLDS,
): InsightReport {
  const insights: Insight[] = [];
  const notEnoughData: string[] = [];

  for (const s of subjects) {
    const comparable = s.mse_pct != null && s.see_pct != null;
    const scores = [s.mse_pct, s.see_pct].filter((v): v is number => v != null);

    if (scores.length >= 2 && scores.every((v) => v >= t.strong_pct)) {
      insights.push({
        type: "STRENGTH",
        ruleId: "strong-subject",
        subject: s.subject,
        message: `${s.subject} is a consistent strength.`,
        evidence: [`MSE ${s.mse_pct}% and SEE ${s.see_pct}% are both ≥ ${t.strong_pct}% (Sem ${s.semester_no})`],
      });
    }

    if (comparable) {
      const delta = (s.see_pct as number) - (s.mse_pct as number);
      if (delta <= -t.decline_pts) {
        insights.push({
          type: "DECLINED",
          ruleId: "mse-see-decline",
          subject: s.subject,
          message: `${s.subject} dropped from MSE to SEE.`,
          evidence: [`MSE ${s.mse_pct}% → SEE ${s.see_pct}% (${Math.round(delta)} points, Sem ${s.semester_no})`],
        });
      } else if (delta >= t.decline_pts) {
        insights.push({
          type: "IMPROVED",
          ruleId: "mse-see-improve",
          subject: s.subject,
          message: `${s.subject} improved from MSE to SEE.`,
          evidence: [`MSE ${s.mse_pct}% → SEE ${s.see_pct}% (+${Math.round(delta)} points, Sem ${s.semester_no})`],
        });
      }
    } else if (scores.length === 1) {
      notEnoughData.push(`${s.subject}: only one assessment recorded, so MSE and SEE can't be compared yet`);
    }

    if (s.total_pct != null && s.total_pct < t.needs_attention_pct) {
      insights.push({
        type: "NEEDS_ATTENTION",
        ruleId: "low-total",
        subject: s.subject,
        message: `${s.subject} could use more attention.`,
        evidence: [`Weighted total ${s.total_pct}% is below ${t.needs_attention_pct}% (Sem ${s.semester_no})`],
      });
    } else if (s.total_pct == null && scores.length === 0) {
      notEnoughData.push(`${s.subject}: no marks recorded yet`);
    }
  }

  const ordered = [...sgpas].sort((a, b) => a.semester_no - b.semester_no);
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    if (prev.sgpa == null || cur.sgpa == null) {
      notEnoughData.push(`Sem ${prev.semester_no} → Sem ${cur.semester_no}: SGPA missing, change not compared`);
      continue;
    }
    const d = Math.round((cur.sgpa - prev.sgpa) * 100) / 100;
    if (d <= -t.sgpa_change) {
      insights.push({
        type: "DECLINED",
        ruleId: "sgpa-drop",
        message: `SGPA dipped in Sem ${cur.semester_no}.`,
        evidence: [`Sem ${prev.semester_no} ${prev.sgpa} → Sem ${cur.semester_no} ${cur.sgpa} (${d})`],
      });
    } else if (d >= t.sgpa_change) {
      insights.push({
        type: "IMPROVED",
        ruleId: "sgpa-rise",
        message: `SGPA rose in Sem ${cur.semester_no}.`,
        evidence: [`Sem ${prev.semester_no} ${prev.sgpa} → Sem ${cur.semester_no} ${cur.sgpa} (+${d})`],
      });
    }
  }

  const latestSem = Math.max(0, ...subjects.map((s) => s.semester_no));
  const focus = new Set(
    insights
      .filter((i) => i.subject && (i.type === "NEEDS_ATTENTION" || (i.type === "DECLINED" && i.ruleId === "mse-see-decline")))
      .filter((i) => subjects.some((s) => s.subject === i.subject && s.semester_no === latestSem))
      .map((i) => i.subject as string),
  );
  for (const subject of focus) {
    const reasons = insights.filter((i) => i.subject === subject && i.type !== "STRENGTH").flatMap((i) => i.evidence);
    insights.push({
      type: "SUGGESTED_FOCUS",
      ruleId: "focus-from-attention",
      subject,
      message: `Focus on ${subject} this semester.`,
      evidence: reasons,
    });
  }

  return { insights, notEnoughData };
}
