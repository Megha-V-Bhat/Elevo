import { ArrowRight, Flag, GraduationCap, UserMinus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChartFrame, CoverageDonut, GroupedBars } from "@/components/charts";
import { Avatar, Card, CardHeader, Meter } from "@/components/ui/display";
import { Bento, EmptyState, HeroCard, PageHeader, StatTile } from "@/components/ui/layout";
import { WorkloadTable } from "@/features/hod/workload-table";
import { FlagChips } from "@/features/mentor/flags";
import { firstName, fmt, greeting } from "@/lib/utils";
import { requirePage } from "@/server/authz";
import { activeAssignments, allStudentIds, mentorActivity } from "@/server/queries/hod";
import { roster } from "@/server/queries/roster";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Home" };

export default async function HodHome({ searchParams }: { searchParams: Promise<{ sem?: string; section?: string }> }) {
  const me = await requirePage("HOD");
  const sp = await searchParams;
  const [ids, mentors, asg] = await Promise.all([allStudentIds(), mentorActivity(), activeAssignments()]);
  const entries = await roster(ids, false, false);
  const supabase = await db();
  const { data: dept } = await supabase.from("departments").select("name").eq("id", me.department_id).maybeSingle();
  const filtered = entries.filter((e) => (!sp.sem || String(e.profile.current_semester) === sp.sem) && (!sp.section || e.profile.section === sp.section));
  const assigned = new Set(asg.map((a) => a.student_id));
  const unassigned = filtered.filter((e) => !assigned.has(e.profile.user_id));
  const flagged = filtered.filter((e) => e.flags.length);
  const coverage = filtered.length ? Math.round(((filtered.length - unassigned.length) / filtered.length) * 100) : 0;
  const incomplete = filtered.filter((e) => e.profile.profile_completion < 80).sort((a, b) => a.profile.profile_completion - b.profile.profile_completion);
  const missing = filtered.filter((e) => e.flags.some((f) => f.ruleId === "missing-results"));
  const sections = [...new Set(entries.map((e) => e.profile.section).filter(Boolean))].sort() as string[];
  const sems = [...new Set(entries.map((e) => e.profile.current_semester).filter(Boolean))].sort() as number[];
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
  };
  const bySection = sections.map((s) => {
    const g = filtered.filter((e) => e.profile.section === s);
    return { label: `Sec ${s}`, values: [avg(g.map((e) => e.latestSgpa)), avg(g.map((e) => e.academics.cgpa))] };
  });

  const filterLink = (k: "sem" | "section", v: string) => {
    const p = new URLSearchParams({ ...(sp.sem ? { sem: sp.sem } : {}), ...(sp.section ? { section: sp.section } : {}) });
    if (p.get(k) === v) p.delete(k);
    else p.set(k, v);
    return `/hod${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName(me.name)}`} subtitle={`${dept?.name ?? "Your department"} at a glance.`} />
      <nav aria-label="Filter overview" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {sems.map((s) => (
          <Link key={`s${s}`} href={filterLink("sem", String(s))} aria-current={sp.sem === String(s) ? "true" : undefined} className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-small font-semibold text-ink-700 aria-[current=true]:border-pine-600 aria-[current=true]:bg-pine-600 aria-[current=true]:text-white">
            Sem {s}
          </Link>
        ))}
        {sections.map((s) => (
          <Link key={`x${s}`} href={filterLink("section", s)} aria-current={sp.section === s ? "true" : undefined} className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-small font-semibold text-ink-700 aria-[current=true]:border-pine-600 aria-[current=true]:bg-pine-600 aria-[current=true]:text-white">
            Section {s}
          </Link>
        ))}
      </nav>
      <Bento>
        <HeroCard className="md:col-span-6 lg:col-span-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <CoverageDonut value={coverage} onPine size={120} />
              <div>
                <p className="label-caps !text-white/80">Mentoring coverage</p>
                <p className="mt-1 font-display text-display-m font-bold tnum">
                  {filtered.length - unassigned.length} of {filtered.length} students
                </p>
                <p className="text-white/90">{unassigned.length ? `${unassigned.length} still need a mentor` : "Everyone has a mentor."}</p>
              </div>
            </div>
            {unassigned.length > 0 && (
              <Link href="/hod/assignments" className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-control bg-white px-4 font-semibold text-pine-700 hover:bg-mint-50 sm:self-auto">
                Assign unassigned <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        </HeroCard>
        <div className="col-span-full grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
          <StatTile label="Students" value={filtered.length} icon={GraduationCap} tone="mint" href="/hod/students" />
          <StatTile label="Mentors" value={mentors.length} icon={Users} tone="lilac" href="/hod/mentors" />
          <StatTile label="Unassigned" value={unassigned.length} icon={UserMinus} tone="butter" href="/hod/students?mentor=unassigned" />
          <StatTile label="Flagged" value={flagged.length} icon={Flag} tone="coral" href="/hod/interventions" helper="With explained reasons" />
        </div>
      </Bento>

      <Bento className="mt-5">
        <Card className="md:col-span-6 lg:col-span-12">
          <CardHeader title="Mentor workload" subtitle="Capacity, activity and response times. Pulse and Ask appear only as aggregates." icon={Users} tone="lilac" />
          {mentors.length ? <WorkloadTable rows={mentors} /> : <EmptyState compact illustration="mentees" title="No mentors yet" action={<Link href="/hod/users?invite=1" className="font-semibold text-pine-600 hover:underline">Invite mentors</Link>} />}
        </Card>
        <Card className="md:col-span-6 lg:col-span-7">
          <ChartFrame bare title="SGPA by section" table={{ columns: ["Section", "Avg latest SGPA", "Avg CGPA"], rows: bySection.map((g) => [g.label, fmt(g.values[0]), fmt(g.values[1])]) }}>
            <CardHeader title="SGPA by section" subtitle="Averages only — students are never ranked." />
            {bySection.length ? <GroupedBars groups={bySection} series={["Latest SGPA", "CGPA"]} /> : <p className="py-8 text-center text-small text-ink-500">Not enough data yet.</p>}
          </ChartFrame>
        </Card>
        <Card className="md:col-span-6 lg:col-span-5">
          <CardHeader title="Intervention list" icon={Flag} tone="coral" action={<Link href="/hod/interventions" className="text-small font-semibold text-pine-600 hover:underline">All →</Link>} />
          {flagged.length ? (
            <ul className="grid gap-2">
              {flagged.slice(0, 6).map((e) => (
                <li key={e.profile.user_id}>
                  <Link href={`/hod/students/${e.profile.user_id}`} className="block rounded-panel border border-line p-3 hover:border-pine-100">
                    <p className="flex items-center gap-2 font-semibold text-ink-900">
                      <Avatar name={e.profile.full_name} size={24} /> {e.profile.full_name}
                    </p>
                    <div className="mt-1.5">
                      <FlagChips flags={e.flags} max={2} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-ink-500">No students flagged.</p>
          )}
        </Card>
        <Card className="md:col-span-3 lg:col-span-6">
          <CardHeader title="Incomplete profiles" subtitle="Below 80% complete" />
          {incomplete.length ? (
            <ul className="grid gap-3">
              {incomplete.slice(0, 6).map((e) => (
                <li key={e.profile.user_id}>
                  <Link href={`/hod/students/${e.profile.user_id}`} className="block">
                    <div className="mb-1 flex justify-between text-small">
                      <span className="font-semibold text-ink-900">{e.profile.full_name || "New student"}</span>
                      <span className="text-ink-500 tnum">{e.profile.profile_completion}%</span>
                    </div>
                    <Meter value={e.profile.profile_completion} label="Profile completion" tone="butter" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-ink-500">Every profile is at least 80% complete.</p>
          )}
        </Card>
        <Card className="md:col-span-3 lg:col-span-6">
          <CardHeader title="Missing current-semester records" />
          {missing.length ? (
            <ul className="grid gap-1.5">
              {missing.slice(0, 8).map((e) => (
                <li key={e.profile.user_id}>
                  <Link href={`/hod/students/${e.profile.user_id}`} className="flex min-h-10 items-center justify-between rounded-control px-2 text-small hover:bg-canvas-sunk">
                    <span className="font-semibold text-ink-900">{e.profile.full_name}</span>
                    <span className="text-ink-500">Sem {e.profile.current_semester}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-ink-500">Everyone has current-semester records.</p>
          )}
        </Card>
      </Bento>
    </>
  );
}
