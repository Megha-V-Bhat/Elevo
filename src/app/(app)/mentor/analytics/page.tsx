import { ClipboardCheck, HeartPulse, Inbox, Timer } from "lucide-react";
import type { Metadata } from "next";
import { ChartFrame, HBars, StackedBar } from "@/components/charts";
import { Card } from "@/components/ui/display";
import { Bento, EmptyState, PageHeader, StatTile } from "@/components/ui/layout";
import { fmt } from "@/lib/utils";
import { requirePage } from "@/server/authz";
import { menteeIds } from "@/server/queries/people";
import { roster } from "@/server/queries/roster";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Analytics" };

export default async function MentorAnalytics() {
  const me = await requirePage("MENTOR");
  const ids = await menteeIds(me.id);
  const supabase = await db();
  const [entries, { data: stats }] = await Promise.all([roster(ids, true), supabase.rpc("mentor_ask_stats")]);
  const s = (stats?.[0] ?? {}) as { open_threads?: number; unanswered_48h?: number; median_first_response_hours?: number | null; pulse_participation_pct?: number | null };
  // Subject averages across mentees (total % where computable), latest semester per student
  const bySubject = new Map<string, number[]>();
  for (const e of entries) {
    const sem = [...e.academics.semesters].reverse().find((x) => x.results.length);
    for (const r of sem?.results ?? []) if (r.total_pct != null) bySubject.set(r.subject.code, [...(bySubject.get(r.subject.code) ?? []), r.total_pct]);
  }
  const subjectRows = [...bySubject.entries()].map(([label, v]) => ({ label, value: Math.round(v.reduce((a, b) => a + b, 0) / v.length), sub: `· ${v.length} students` })).sort((a, b) => a.value - b.value);
  const statuses = entries.flatMap((e) => e.academics.semesters.map((x) => x.status));
  return (
    <>
      <PageHeader title="Analytics" subtitle="Across your current mentees. Aggregates only — individual students are never ranked." />
      <div className="grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
        <StatTile label="Open questions" value={s.open_threads ?? 0} icon={Inbox} tone="lilac" href="/mentor/inbox?filter=open" />
        <StatTile label="Waiting > 48 h" value={s.unanswered_48h ?? 0} icon={Timer} tone="butter" href="/mentor/inbox?filter=unanswered" />
        <StatTile label="Median first reply" value={s.median_first_response_hours == null ? "—" : `${fmt(s.median_first_response_hours, 1)} h`} icon={Timer} tone="sky" />
        <StatTile label="Pulse participation" value={s.pulse_participation_pct == null ? "—" : `${s.pulse_participation_pct}%`} icon={HeartPulse} tone="mint" helper="Checked in during the last 4 weeks" />
      </div>
      <Bento className="mt-5">
        <Card className="md:col-span-6 lg:col-span-7">
          <ChartFrame bare title="Subject averages" table={{ columns: ["Subject", "Average total %", "Students"], rows: subjectRows.map((r) => [r.label, r.value, r.sub.replace(/\D/g, "")]) }}>
            <h2 className="mb-1 font-display text-h3 font-semibold text-ink-900">Subject averages</h2>
            <p className="mb-4 text-small text-ink-500">Latest semester, weighted total % where computable. Lowest first — where support may help most.</p>
            {subjectRows.length ? <HBars rows={subjectRows} max={100} unit="%" /> : <EmptyState compact illustration="marks" title="Not enough data" />}
          </ChartFrame>
        </Card>
        <Card className="md:col-span-6 lg:col-span-5">
          <h2 className="mb-1 flex items-center gap-2 font-display text-h3 font-semibold text-ink-900">
            <ClipboardCheck className="size-5 text-butter-800" aria-hidden /> Verification backlog
          </h2>
          <p className="mb-4 text-small text-ink-500">All semesters across your mentees by status.</p>
          <StackedBar
            segments={[
              { label: "Draft", value: statuses.filter((x) => x === "DRAFT").length, color: "#CFD8CF" },
              { label: "Submitted", value: statuses.filter((x) => x === "SUBMITTED").length, color: "#8B7CF6" },
              { label: "Verified", value: statuses.filter((x) => x === "VERIFIED").length, color: "#0F766E" },
              { label: "Finalized", value: statuses.filter((x) => x === "FINALIZED").length, color: "#0B4F4A" },
            ]}
          />
          <h3 className="mt-6 mb-3 font-semibold text-ink-900">Students with flags</h3>
          <p className="font-display text-display-m font-bold text-ink-900 tnum">
            {entries.filter((e) => e.flags.length).length}
            <span className="text-body font-medium text-ink-500"> of {entries.length}</span>
          </p>
        </Card>
      </Bento>
    </>
  );
}
