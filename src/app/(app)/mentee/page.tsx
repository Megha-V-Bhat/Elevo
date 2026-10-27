import { ArrowRight, BookOpen, CalendarDays, HeartPulse, MessageCircleQuestion, Sparkles, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreditPath, GrowthRings, PulseStrip, RingLegend, TrendLine } from "@/components/charts";
import { Card, CardHeader, Chip, DeltaChip, Meter, StatusPill } from "@/components/ui/display";
import { Bento, EmptyState, HeroCard, PageHeader } from "@/components/ui/layout";
import { NextStepCard } from "@/components/ui/next-step";
import { MOOD_TEXT, MoodFace } from "@/features/pulse/faces";
import { currentWeekStart, fmtDate, fmtDateTime } from "@/lib/dates";
import { firstName, fmt, greeting } from "@/lib/utils";
import { requirePage } from "@/server/authz";
import { loadAcademics } from "@/server/queries/academics";
import { listThreads } from "@/server/queries/ask";
import { recommendations, resources, sessions } from "@/server/queries/mentoring";
import { mentorOf, studentProfile } from "@/server/queries/people";
import { ownPulse, toStrip } from "@/server/queries/pulse";
import { appSettings } from "@/server/queries/settings";

export const metadata: Metadata = { title: "Home" };

export default async function MenteeHome() {
  const me = await requirePage("MENTEE");
  const [a, profile, mentor, recs, upcoming, pulse, settings, res, threads] = await Promise.all([
    loadAcademics(me.id, me.department_id),
    studentProfile(me.id),
    mentorOf(me.id),
    recommendations({ studentId: me.id, viewerId: me.id, limit: 30 }),
    sessions({ studentId: me.id, upcoming: true, limit: 3 }),
    ownPulse(me.id),
    appSettings(),
    resources({ viewerId: me.id, limit: 12 }),
    listThreads({ studentId: me.id, limit: 10 }),
  ]);
  const week = currentWeekStart(settings.pulse_week_start);
  const thisWeek = pulse.find((p) => p.week_start === week);
  const withSgpa = a.semesters.filter((s) => s.sgpa != null);
  const last = withSgpa.at(-1);
  const prev = withSgpa.at(-2);
  const latestFeedback = recs.find((r) => r.kind === "FEEDBACK" || r.kind === "RECOMMENDATION");
  const goals = recs.filter((r) => r.kind === "GOAL" || r.kind === "ACTION_POINT");
  const openGoals = goals.filter((g) => g.status !== "COMPLETED");
  const newRes = res.filter((r) => !r.seen);
  const openThreads = threads.filter((t) => t.status !== "RESOLVED");
  const draft = a.semesters.find((s) => s.status === "DRAFT" && s.results.length);
  const answered = threads.find((t) => t.status === "ANSWERED");

  // One data-driven next step
  const next = !thisWeek
    ? { id: "pulse", title: "Your 30-second check-in", body: "How did this week feel? It helps your mentor notice early.", href: "/mentee/pulse", cta: "Check in" }
    : answered
      ? { id: `ask-${answered.id}`, title: "Your mentor replied", body: answered.title, href: `/mentee/ask/${answered.id}`, cta: "Read reply" }
      : draft
        ? { id: `submit-${draft.id}`, title: `Submit Semester ${draft.semester_no}`, body: "Once it's complete, send it for verification so it counts as verified.", href: `/mentee/academics/${draft.semester_no}`, cta: "Review and submit" }
        : (profile?.profile_completion ?? 0) < 80
          ? { id: "profile", title: "Complete your profile", body: `It's ${profile?.profile_completion ?? 0}% done. A fuller profile helps your mentor guide you.`, href: "/mentee/profile", cta: "Finish profile" }
          : { id: "plan", title: "Plan your next goal", body: "See exactly what SGPA or SEE marks you need for your target.", href: "/mentee/planner", cta: "Open planner" };

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName(profile?.full_name || me.name)}`}
        subtitle={
          mentor
            ? `${openGoals.length ? `${openGoals.length} open goal${openGoals.length > 1 ? "s" : ""}` : "No open goals"} · ${upcoming.length ? `next session ${fmtDate(upcoming[0].scheduled_at, { weekday: "short", day: "numeric", month: "short" })}` : "no sessions scheduled"}`
            : "Your HOD will assign you a mentor soon."
        }
      />
      <Bento>
        <HeroCard className="md:col-span-6 lg:col-span-8">
          {a.semesters.length ? (
            <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
              <div className="mx-auto">
                <GrowthRings semesters={a.semesters.map((s) => ({ no: s.semester_no, sgpa: s.sgpa, credits: s.credits }))} cgpa={a.cgpa} size={190} onPine />
              </div>
              <div>
                <p className="label-caps !text-white">Your growth</p>
                <p className="mt-1 font-display text-display-m font-bold tnum">{a.cgpa == null ? "CGPA not calculated yet" : `${a.cgpa.toFixed(2)} CGPA`}</p>
                <p className="mt-1 text-white">{a.cgpa == null ? a.cgpa_reason : `across ${withSgpa.length} semester${withSgpa.length > 1 ? "s" : ""} · ${a.earned_credits} credits`}</p>
                {last && prev && (
                  <p className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-small font-semibold">
                    {(last.sgpa as number) >= (prev.sgpa as number) ? "↑" : "↓"} {Math.abs((last.sgpa as number) - (prev.sgpa as number)).toFixed(2)} SGPA vs Sem {prev.semester_no}
                  </p>
                )}
                <div className="mt-4">
                  <RingLegend onPine />
                </div>
                <Link href="/mentee/academics" className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-control bg-white px-4 font-semibold text-pine-700 hover:bg-mint-50">
                  View academics <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="py-4">
              <p className="label-caps !text-white">Let&apos;s begin</p>
              <p className="mt-1 font-display text-display-m font-bold">Add your first semester</p>
              <p className="mt-1 max-w-[44ch] text-white">Your growth rings appear as soon as marks are in. It takes about five minutes.</p>
              <Link href="/mentee/academics?new=1" className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-control bg-white px-4 font-semibold text-pine-700 hover:bg-mint-50">
                Add a semester <ArrowRight className="size-4" />
              </Link>
            </div>
          )}
        </HeroCard>

        <div className="md:col-span-6 lg:col-span-4">
          <NextStepCard {...next} />
        </div>

        <Card className="md:col-span-6 lg:col-span-7">
          <CardHeader title="SGPA trend" icon={Sparkles} action={last && prev ? <DeltaChip value={Math.round(((last.sgpa as number) - (prev.sgpa as number)) * 100) / 100} label={`vs Sem ${prev.semester_no}`} /> : undefined} />
          {withSgpa.length ? <TrendLine points={a.semesters.map((s) => ({ label: `S${s.semester_no}`, value: s.sgpa }))} max={a.scheme.max_points} height={180} /> : <p className="py-8 text-center text-small text-ink-500">Your trend appears once a semester has an SGPA.</p>}
        </Card>

        <Card className="md:col-span-3 lg:col-span-5">
          <CardHeader title="This week's pulse" icon={HeartPulse} tone="coral" />
          {thisWeek ? (
            <div className="flex items-center gap-3">
              <MoodFace mood={thisWeek.mood} size={44} />
              <div>
                <p className="font-semibold text-ink-900">Thanks — see you next week.</p>
                <p className="text-small text-ink-500">
                  {MOOD_TEXT[thisWeek.mood]} · {thisWeek.workload.toLowerCase()} workload
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-body text-ink-700">Three quick questions about your week.</p>
              <Link href="/mentee/pulse" className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-control bg-mint-100 px-4 font-semibold text-pine-700 hover:bg-mint-50">
                Check in now <ArrowRight className="size-4" />
              </Link>
            </div>
          )}
          <div className="mt-4">
            <PulseStrip weeks={toStrip(pulse.map((p) => ({ week_start: p.week_start, mood: p.mood, workload: p.workload })), settings.pulse_week_start)} compact />
          </div>
        </Card>

        <Card className="md:col-span-3 lg:col-span-4">
          <CardHeader title="From your mentor" icon={Sparkles} tone="lilac" />
          {latestFeedback ? (
            <div>
              <div className="flex flex-wrap gap-1.5">
                {!latestFeedback.seen && <Chip tone="pine">New</Chip>}
                <Chip>{fmtDate(latestFeedback.created_at, { day: "numeric", month: "short" })}</Chip>
              </div>
              <p className="mt-2 font-semibold text-ink-900">{latestFeedback.title}</p>
              {latestFeedback.body && <p className="mt-1 line-clamp-3 text-small text-ink-700">{latestFeedback.body}</p>}
              <Link href="/mentee/mentoring" className="mt-3 inline-flex min-h-9 items-center text-small font-semibold text-pine-600 hover:underline">
                All feedback →
              </Link>
            </div>
          ) : (
            <EmptyState compact illustration="feedback" title="Nothing shared yet" />
          )}
        </Card>

        <Card className="md:col-span-3 lg:col-span-4">
          <CardHeader title="Goals" icon={Target} />
          {goals.length ? (
            <ul className="grid gap-3">
              {goals.slice(0, 4).map((g) => {
                const pct = g.status === "COMPLETED" ? 100 : g.steps.length ? (g.steps.filter((s) => s.done).length / g.steps.length) * 100 : g.status === "IN_PROGRESS" ? 40 : 0;
                return (
                  <li key={g.id}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-small">
                      <span className="truncate font-semibold text-ink-900">{g.title}</span>
                      <span className="text-ink-500 tnum">{Math.round(pct)}%</span>
                    </div>
                    <Meter value={pct} label={g.title} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-small text-ink-500">Goals your mentor sets with you appear here.</p>
          )}
        </Card>

        <Card className="md:col-span-3 lg:col-span-4">
          <CardHeader title="Next session" icon={CalendarDays} tone="sky" />
          {upcoming[0] ? (
            <div>
              <p className="font-display text-h3 font-semibold text-ink-900">{fmtDateTime(upcoming[0].scheduled_at)}</p>
              <p className="text-small text-ink-500">
                With {upcoming[0].mentor_name} · {upcoming[0].mode === "ONLINE" ? "Online" : (upcoming[0].location_or_link ?? "In person")}
              </p>
              {upcoming[0].agenda && <p className="mt-2 line-clamp-2 text-small text-ink-700">{upcoming[0].agenda}</p>}
            </div>
          ) : (
            <p className="text-small text-ink-500">No sessions scheduled.</p>
          )}
        </Card>

        <Card className="md:col-span-6 lg:col-span-7">
          <CardHeader title="New resources" icon={BookOpen} tone="lilac" action={<Link href="/mentee/resources" className="text-small font-semibold text-pine-600 hover:underline">Library →</Link>} />
          {newRes.length ? (
            <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {newRes.slice(0, 6).map((r) => (
                <li key={r.id} className="w-56 shrink-0 rounded-panel border border-line bg-lilac-50 p-3">
                  <p className="line-clamp-2 font-semibold text-ink-900">{r.title}</p>
                  <p className="mt-1 text-small text-ink-500">{r.subject?.code ?? "General"} · {fmtDate(r.created_at, { day: "numeric", month: "short" })}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-ink-500">You&apos;re up to date. {res.length ? `${res.length} resources in your library.` : ""}</p>
          )}
        </Card>

        <Card className="md:col-span-6 lg:col-span-5">
          <CardHeader title="Your questions" icon={MessageCircleQuestion} tone="lilac" action={<Link href="/mentee/ask/new" className="text-small font-semibold text-pine-600 hover:underline">Ask →</Link>} />
          {openThreads.length ? (
            <ul className="grid gap-2">
              {openThreads.slice(0, 3).map((t) => (
                <li key={t.id}>
                  <Link href={`/mentee/ask/${t.id}`} className="flex min-h-11 items-center justify-between gap-2 rounded-control px-2 hover:bg-canvas-sunk">
                    <span className="truncate text-small font-semibold text-ink-900">{t.title}</span>
                    <StatusPill status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-ink-500">No open questions. Stuck on something? Ask your mentor.</p>
          )}
        </Card>

        <Card className="md:col-span-6 lg:col-span-12">
          <CardHeader title="Credit path" icon={Target} tone="butter" subtitle={`Latest SGPA ${fmt(last?.sgpa)}`} />
          <CreditPath
            earned={a.semesters.filter((s) => s.status === "VERIFIED" || s.status === "FINALIZED").reduce((x, s) => x + (s.credits ?? 0), 0)}
            inProgress={a.semesters.filter((s) => s.status === "DRAFT" || s.status === "SUBMITTED").reduce((x, s) => x + (s.credits ?? 0), 0)}
            total={settings.program_total_credits}
          />
        </Card>
      </Bento>
    </>
  );
}
