import { CircleHelp, Compass, Leaf, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { ChartFrame, CreditPath, GrowthRings, PairedBars, StackedBar, SubjectBloom, TrendLine } from "@/components/charts";
import { Card, DeltaChip, IconTile } from "@/components/ui/display";
import { Bento, EmptyState } from "@/components/ui/layout";
import type { Insight, InsightReport } from "@/lib/engine/insights";
import { cn, fmt } from "@/lib/utils";
import type { Academics } from "@/server/queries/academics";

const GROUPS = [
  { key: "strengths", title: "Strengths", types: ["STRENGTH", "IMPROVED"], bg: "bg-mint-50", icon: Leaf, tone: "mint" as const },
  { key: "attention", title: "Needs attention", types: ["NEEDS_ATTENTION", "DECLINED"], bg: "bg-coral-50", icon: TriangleAlert, tone: "coral" as const },
  { key: "focus", title: "Suggested focus", types: ["SUGGESTED_FOCUS"], bg: "bg-lilac-50", icon: Compass, tone: "lilac" as const },
];

export function InsightCard({ i }: { i: Insight }) {
  const Icon = i.type === "IMPROVED" ? TrendingUp : i.type === "DECLINED" ? TrendingDown : null;
  return (
    <li className="rounded-panel border border-line bg-surface p-3.5">
      <p className="flex items-start gap-2 font-semibold text-ink-900">
        {Icon && <Icon className={cn("mt-0.5 size-4 shrink-0", i.type === "IMPROVED" ? "text-pine-600" : "text-coral-700")} aria-hidden />}
        {i.message}
      </p>
      <details className="group mt-1">
        <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-small font-semibold text-pine-600 [&::-webkit-details-marker]:hidden">
          <CircleHelp className="size-3.5" aria-hidden /> Why am I seeing this?
        </summary>
        <ul className="mt-1.5 grid gap-1 rounded-control bg-canvas-sunk p-2.5 text-small text-ink-700">
          {i.evidence.map((e) => (
            <li key={e} className="tnum">
              {e}
            </li>
          ))}
          <li className="text-ink-500">Rule: {i.ruleId}</li>
        </ul>
      </details>
    </li>
  );
}

export function InsightGroups({ report, compact }: { report: InsightReport; compact?: boolean }) {
  return (
    <div className={cn("grid gap-4", !compact && "lg:grid-cols-3")}>
      {GROUPS.map((g) => {
        const items = report.insights.filter((i) => g.types.includes(i.type));
        return (
          <section key={g.key} className={cn("rounded-card border border-line p-4", g.bg)}>
            <h3 className="mb-3 flex items-center gap-2 font-display text-h3 font-semibold text-ink-900">
              <IconTile icon={g.icon} tone={g.tone} size="sm" /> {g.title}
              <span className="ml-auto text-small font-semibold text-ink-500 tnum">{items.length}</span>
            </h3>
            {items.length ? (
              <ul className="grid gap-2">
                {items.map((i, k) => (
                  <InsightCard key={`${i.ruleId}-${i.subject}-${k}`} i={i} />
                ))}
              </ul>
            ) : (
              <p className="text-small text-ink-700">{g.key === "attention" ? "Nothing flagged. Keep it steady." : g.key === "strengths" ? "Strengths appear once two comparable assessments are in." : "No focus areas right now."}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function InsightsView({ a, report, semester, basePath, owner }: { a: Academics; report: InsightReport; semester: number | null; basePath: string; owner: "self" | "mentor" }) {
  if (!a.semesters.length)
    return (
      <Card>
        <EmptyState
          illustration="marks"
          title="No data to analyse yet"
          body={owner === "self" ? "Insights appear once you add a semester's marks." : "This student hasn't added any academic records yet."}
          action={owner === "self" ? <Link href="/mentee/academics?new=1" className="font-semibold text-pine-600 underline-offset-4 hover:underline">Add a semester</Link> : undefined}
        />
      </Card>
    );
  const sel = a.semesters.find((s) => s.semester_no === semester) ?? [...a.semesters].reverse().find((s) => s.results.length) ?? a.semesters.at(-1)!;
  const withSgpa = a.semesters.filter((s) => s.sgpa != null);
  const last = withSgpa.at(-1);
  const prev = withSgpa.at(-2);
  const delta = last && prev ? Math.round(((last.sgpa as number) - (prev.sgpa as number)) * 100) / 100 : null;
  const all = a.semesters.flatMap((s) => s.results);
  const ringData = a.semesters.map((s) => ({ no: s.semester_no, sgpa: s.sgpa, credits: s.credits }));

  return (
    <div className="grid gap-5">
      <nav aria-label="Semester filter" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {a.semesters.map((s) => (
          <Link
            key={s.id}
            href={`${basePath}?sem=${s.semester_no}`}
            scroll={false}
            aria-current={s.id === sel.id ? "true" : undefined}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-small font-semibold transition-colors",
              s.id === sel.id ? "border-pine-600 bg-pine-600 text-white" : "border-line bg-surface text-ink-700 hover:border-pine-100",
            )}
          >
            Sem {s.semester_no}
          </Link>
        ))}
      </nav>

      <Bento>
        <Card className="md:col-span-3 lg:col-span-4">
          <ChartFrame bare title="CGPA growth rings" table={{ columns: ["Semester", "SGPA", "Credits"], rows: ringData.map((r) => [r.no, fmt(r.sgpa), r.credits]) }}>
            <div className="flex flex-col items-center">
              <GrowthRings semesters={ringData} cgpa={a.cgpa} size={200} />
              <p className="mt-2 text-center text-small text-ink-500">{a.cgpa == null ? a.cgpa_reason : `${a.earned_credits} credits counted`}</p>
            </div>
          </ChartFrame>
        </Card>
        <Card className="md:col-span-3 lg:col-span-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-h3 font-semibold text-ink-900">SGPA trend</h2>
            {prev && last && <DeltaChip value={delta} label={`vs Sem ${prev.semester_no}`} />}
          </div>
          <ChartFrame bare title="SGPA trend" table={{ columns: ["Semester", "SGPA"], rows: a.semesters.map((s) => [`Sem ${s.semester_no}`, fmt(s.sgpa)]) }}>
            {withSgpa.length >= 1 ? (
              <TrendLine points={a.semesters.map((s) => ({ label: `Sem ${s.semester_no}`, value: s.sgpa }))} max={a.scheme.max_points} />
            ) : (
              <p className="py-10 text-center text-small text-ink-500">Not enough data: no semester has an SGPA yet.</p>
            )}
          </ChartFrame>
        </Card>

        <Card className="md:col-span-6 lg:col-span-7">
          <ChartFrame
            title={`MSE vs SEE · Semester ${sel.semester_no}`}
            description="Percentages are shown only where maximum marks are known."
            bare={false}
            className="border-0 p-0 shadow-none"
            table={{ columns: ["Subject", "MSE %", "SEE %"], rows: sel.results.map((r) => [r.subject.name, r.mse_pct, r.see_pct]) }}
          >
            {sel.results.length ? (
              <PairedBars rows={sel.results.map((r) => ({ label: r.subject.code, a: r.mse_pct, b: r.see_pct }))} />
            ) : (
              <p className="py-8 text-center text-small text-ink-500">No subject marks in this semester.</p>
            )}
          </ChartFrame>
        </Card>
        <Card className="md:col-span-6 lg:col-span-5">
          <ChartFrame
            title="Subject bloom"
            description="Petal length is the weighted total %. Tap a petal for details."
            className="border-0 p-0 shadow-none"
            table={{ columns: ["Subject", "Total %", "Grade"], rows: sel.results.map((r) => [r.subject.name, r.total_pct, r.grade ?? r.derived_grade]) }}
          >
            {sel.results.length ? (
              <SubjectBloom petals={sel.results.map((r) => ({ label: r.subject.code, value: r.total_pct }))} />
            ) : (
              <p className="py-8 text-center text-small text-ink-500">No subject marks in this semester.</p>
            )}
          </ChartFrame>
        </Card>

        <Card className="md:col-span-3 lg:col-span-6">
          <h2 className="mb-4 font-display text-h3 font-semibold text-ink-900">Credit completion</h2>
          <CreditPath
            earned={a.semesters.filter((s) => s.status === "VERIFIED" || s.status === "FINALIZED").reduce((x, s) => x + (s.credits ?? 0), 0)}
            inProgress={a.semesters.filter((s) => s.status === "DRAFT" || s.status === "SUBMITTED").reduce((x, s) => x + (s.credits ?? 0), 0)}
            total={null}
          />
        </Card>
        <Card className="md:col-span-3 lg:col-span-6">
          <h2 className="mb-4 font-display text-h3 font-semibold text-ink-900">Result summary</h2>
          <StackedBar
            segments={[
              { label: "Pass", value: all.filter((r) => r.result === "PASS").length, color: "#34D399" },
              { label: "Pending", value: all.filter((r) => r.result === "PENDING").length, color: "#CFD8CF" },
              { label: "Absent", value: all.filter((r) => r.result === "ABSENT").length, color: "#FBBF24" },
              { label: "Fail", value: all.filter((r) => r.result === "FAIL").length, color: "#F06A6A" },
            ]}
          />
          <p className="mt-3 text-small text-ink-500">Across all {all.length} subjects recorded{owner === "self" ? " — yours only" : ""}.</p>
        </Card>
      </Bento>

      <section>
        <h2 className="mb-3 font-display text-h3 font-semibold text-ink-900">Insights</h2>
        <p className="mb-4 text-small text-ink-500">Rule-based and transparent. Comparisons are only ever with {owner === "self" ? "your own" : "this student's own"} past results.</p>
        <InsightGroups report={report} />
        {report.notEnoughData.length > 0 && (
          <details className="mt-4 rounded-card border border-line bg-surface p-4">
            <summary className="cursor-pointer font-semibold text-ink-900">Not enough data to compare ({report.notEnoughData.length})</summary>
            <ul className="mt-2 grid gap-1 text-small text-ink-700">
              {report.notEnoughData.map((n) => (
                <li key={n}>• {n}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
