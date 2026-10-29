import { CalendarDays, HeartPulse, Inbox, MessageSquareText, Percent } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { ChartFrame, GroupedBars, HBars, StackedBar, TrendLine } from "@/components/charts";
import { Card, CardHeader } from "@/components/ui/display";
import { Bento, PageHeader, StatTile } from "@/components/ui/layout";
import { fmt } from "@/lib/utils";
import { requirePage } from "@/server/authz";
import { allStudentIds, mentorActivity } from "@/server/queries/hod";
import { roster } from "@/server/queries/roster";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Analytics" };

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
};

export default async function HodAnalytics({ searchParams }: { searchParams: Promise<{ section?: string; year?: string }> }) {
  await requirePage("HOD");
  const sp = await searchParams;
  const supabase = await db();
  const [ids, mentors, { data: ask }, { data: pulse }] = await Promise.all([allStudentIds(), mentorActivity(), supabase.rpc("hod_ask_summary"), supabase.rpc("hod_pulse_participation")]);
  const all = await roster(ids, false, false);
  const entries = all.filter((e) => (!sp.section || e.profile.section === sp.section) && (!sp.year || String(e.profile.admission_year) === sp.year));
  const sections = [...new Set(all.map((e) => e.profile.section).filter(Boolean))].sort() as string[];
  const years = [...new Set(all.map((e) => e.profile.admission_year).filter(Boolean))].sort() as number[];

  // SGPA trend by semester number (department average)
  const semNos = [...new Set(entries.flatMap((e) => e.academics.semesters.map((s) => s.semester_no)))].sort((a, b) => a - b);
  const trend = semNos.map((n) => ({ label: `S${n}`, value: avg(entries.map((e) => e.academics.semesters.find((s) => s.semester_no === n)?.sgpa ?? null)) }));
  // Pass rate per semester number
  const passRows = semNos.map((n) => {
    const rs = entries.flatMap((e) => e.academics.semesters.find((s) => s.semester_no === n)?.results ?? []).filter((r) => r.result !== "PENDING");
    return { label: `Semester ${n}`, value: rs.length ? Math.round((rs.filter((r) => r.result === "PASS").length / rs.length) * 100) : 0, sub: `· ${rs.length} results` };
  });
  // SGPA distribution (latest)
  const latest = entries.map((e) => e.latestSgpa).filter((x): x is number => x != null);
  const bands = [
    { label: "8.5+", value: latest.filter((x) => x >= 8.5).length, color: "#34D399" },
    { label: "7 – 8.49", value: latest.filter((x) => x >= 7 && x < 8.5).length, color: "#14B8A6" },
    { label: "6 – 6.99", value: latest.filter((x) => x >= 6 && x < 7).length, color: "#8B7CF6" },
    { label: "Below 6", value: latest.filter((x) => x < 6).length, color: "#FBBF24" },
  ];
  const bySection = sections.map((s) => ({ label: `Sec ${s}`, values: [avg(entries.filter((e) => e.profile.section === s).map((e) => e.latestSgpa)), avg(entries.filter((e) => e.profile.section === s).map((e) => e.academics.cgpa))] }));
  const a = (ask?.[0] ?? {}) as { open_threads?: number; unanswered_48h?: number; median_first_response_hours?: number | null };
  const pulseRows = (pulse ?? []) as { section: string; students: number; participation_pct: number }[];
  const link = (k: string, v: string) => {
    const p = new URLSearchParams({ ...(sp.section ? { section: sp.section } : {}), ...(sp.year ? { year: sp.year } : {}) });
    if (p.get(k) === v) p.delete(k);
    else p.set(k, v);
    return `/hod/analytics${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Analytics" subtitle="Department trends and mentoring activity. Aggregates only — no student is ranked, and Pulse/Ask appear only as participation and response times." />
      <nav aria-label="Filters" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {sections.map((s) => (
          <Link key={s} href={link("section", s)} aria-current={sp.section === s ? "true" : undefined} className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-small font-semibold text-ink-700 aria-[current=true]:border-pine-600 aria-[current=true]:bg-pine-600 aria-[current=true]:text-white">
            Section {s}
          </Link>
        ))}
        {years.map((y) => (
          <Link key={y} href={link("year", String(y))} aria-current={sp.year === String(y) ? "true" : undefined} className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-small font-semibold text-ink-700 aria-[current=true]:border-pine-600 aria-[current=true]:bg-pine-600 aria-[current=true]:text-white">
            Batch {y}
          </Link>
        ))}
      </nav>
      <div className="grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-5">
        <StatTile label="Average CGPA" value={fmt(avg(entries.map((e) => e.academics.cgpa)))} icon={Percent} tone="mint" helper={`${entries.length} students`} />
        <StatTile label="Feedback (30 days)" value={mentors.reduce((x, m) => x + m.feedback_30d, 0)} icon={MessageSquareText} tone="lilac" />
        <StatTile label="Sessions (30 days)" value={mentors.reduce((x, m) => x + m.sessions_30d, 0)} icon={CalendarDays} tone="sky" />
        <StatTile label="Open questions" value={a.open_threads ?? 0} icon={Inbox} tone="butter" helper={`Median first reply ${a.median_first_response_hours == null ? "—" : `${fmt(Number(a.median_first_response_hours), 1)} h`}`} />
        <StatTile label="Pulse participation" value={pulseRows.length ? `${Math.round(pulseRows.reduce((x, r) => x + Number(r.participation_pct) * r.students, 0) / Math.max(1, pulseRows.reduce((x, r) => x + r.students, 0)))}%` : "—"} icon={HeartPulse} tone="coral" helper="Last 4 weeks" />
      </div>
      <Bento className="mt-5">
        <Card className="md:col-span-6 lg:col-span-7">
          <ChartFrame bare title="Average SGPA by semester" table={{ columns: ["Semester", "Average SGPA"], rows: trend.map((t) => [t.label, fmt(t.value)]) }}>
            <CardHeader title="Average SGPA by semester" />
            <TrendLine points={trend} />
          </ChartFrame>
        </Card>
        <Card className="md:col-span-6 lg:col-span-5">
          <ChartFrame bare title="Latest SGPA distribution" table={{ columns: ["Band", "Students"], rows: bands.map((b) => [b.label, b.value]) }}>
            <CardHeader title="Latest SGPA distribution" />
            <StackedBar segments={bands} />
          </ChartFrame>
        </Card>
        <Card className="md:col-span-6 lg:col-span-6">
          <ChartFrame bare title="Pass rate by semester" table={{ columns: ["Semester", "Pass %"], rows: passRows.map((r) => [r.label, r.value]) }}>
            <CardHeader title="Pass rate by semester" />
            <HBars rows={passRows} max={100} unit="%" tone="mint" />
          </ChartFrame>
        </Card>
        <Card className="md:col-span-6 lg:col-span-6">
          <ChartFrame bare title="SGPA and CGPA by section" table={{ columns: ["Section", "Avg latest SGPA", "Avg CGPA"], rows: bySection.map((g) => [g.label, fmt(g.values[0]), fmt(g.values[1])]) }}>
            <CardHeader title="By section" />
            <GroupedBars groups={bySection} series={["Latest SGPA", "CGPA"]} />
          </ChartFrame>
        </Card>
        <Card className="md:col-span-6 lg:col-span-6">
          <ChartFrame bare title="Pulse participation by section" table={{ columns: ["Section", "Students", "Participation %"], rows: pulseRows.map((r) => [r.section, r.students, r.participation_pct]) }}>
            <CardHeader title="Pulse participation by section" subtitle="Share of students who checked in during the last 4 weeks. No content." />
            <HBars rows={pulseRows.map((r) => ({ label: `Section ${r.section}`, value: Number(r.participation_pct), sub: `· ${r.students}` }))} max={100} unit="%" tone="lilac" />
          </ChartFrame>
        </Card>
        <Card className="md:col-span-6 lg:col-span-6">
          <ChartFrame bare title="Mentees per mentor" table={{ columns: ["Mentor", "Mentees", "Capacity"], rows: mentors.map((m) => [m.full_name, m.mentees, m.capacity]) }}>
            <CardHeader title="Coverage by mentor" />
            <HBars rows={mentors.map((m) => ({ label: m.full_name, value: m.mentees, sub: `/ ${m.capacity}`, href: `/hod/mentors/${m.mentor_id}` }))} max={Math.max(1, ...mentors.map((m) => m.capacity))} />
          </ChartFrame>
        </Card>
      </Bento>
    </>
  );
}
