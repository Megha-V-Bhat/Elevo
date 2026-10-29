import { ArrowLeft, Download, Eye, FileText, MessageCircleQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { ChartFrame, GrowthRings, PULSE_LEGEND, PulseStrip, TrendLine } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Chip, StatusPill } from "@/components/ui/display";
import { Bento, EmptyState, KeyValue, PageHeader, Section } from "@/components/ui/layout";
import { TabStrip } from "@/components/ui/tabs";
import { ResultsTable } from "@/features/academics/results-table";
import { InsightGroups, InsightsView } from "@/features/insights/insights-view";
import { loadJourney, SteppingStones } from "@/features/journey/journey";
import { RecComposer, ResourceUploader, SessionActions, SessionScheduler } from "@/features/mentor/composers";
import { FlagChips } from "@/features/mentor/flags";
import { PulseSeenButton } from "@/features/mentor/pulse-seen";
import { RecItem } from "@/features/mentoring/rec-item";
import { ResourceCard } from "@/features/mentoring/resource-card";
import { SessionCard } from "@/features/mentoring/session-card";
import { IdentityColumn } from "@/features/profile/identity";
import { MOOD_TEXT, MoodFace } from "@/features/pulse/faces";
import { fmtDate } from "@/lib/dates";
import { pulseSignals } from "@/lib/engine/pulse";
import { fmt } from "@/lib/utils";
import { isActiveMentorOf, requirePage } from "@/server/authz";
import { insightsFrom, loadAcademics, riskFrom, subjectCatalog, thresholds } from "@/server/queries/academics";
import { listThreads } from "@/server/queries/ask";
import { recommendations, resources, sessions } from "@/server/queries/mentoring";
import { menteeProfiles, studentProfile } from "@/server/queries/people";
import { asEngine, mentorPulse, toStrip } from "@/server/queries/pulse";
import { appSettings } from "@/server/queries/settings";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Mentee profile" };

const TABS = ["overview", "academics", "insights", "mentoring", "resources", "sessions", "journey", "pulse", "ask", "plans", "report"] as const;
type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, string> = { overview: "Overview", academics: "Academics", insights: "Insights", mentoring: "Mentoring", resources: "Resources", sessions: "Sessions", journey: "Journey", pulse: "Pulse", ask: "Ask", plans: "Plans", report: "Report" };

export default async function MentorMentee({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; sem?: string; type?: string }> }) {
  const me = await requirePage("MENTOR");
  const { id } = await params;
  const sp = await searchParams;
  // Server-side guard in addition to RLS: only CURRENT mentees. The profile read is RLS-scoped
  // too, so fetching it alongside the check leaks nothing and saves a round trip.
  const [assigned, p] = await Promise.all([isActiveMentorOf(me.id, id), studentProfile(id)]);
  if (!assigned || !p) notFound();
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";
  const base = `/mentor/mentees/${id}`;
  const [a, t, settings, catalog, recs, pulseRows, threads, mentees] = await Promise.all([
    loadAcademics(id, p.department_id),
    thresholds(p.department_id),
    appSettings(),
    subjectCatalog(p.department_id),
    recommendations({ studentId: id }),
    mentorPulse(id),
    listThreads({ studentId: id }),
    menteeProfiles(me.id),
  ]);
  const report = insightsFrom(a, t.insight);
  const flags = riskFrom(a, report, { current_semester: p.current_semester, profile_completion: p.profile_completion, created_at: p.created_at }, t.risk);
  const pulse = pulseSignals(asEngine(pulseRows));
  const subjects = catalog.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }));
  const strip = toStrip(pulseRows.map((r) => ({ week_start: r.week_start, mood: r.mood, workload: r.workload, has_note: r.note_shared })), settings.pulse_week_start);
  const openThreads = threads.filter((x) => x.status !== "RESOLVED").length;

  return (
    <>
      <Link href="/mentor/mentees" className="mb-3 inline-flex min-h-9 items-center gap-1 text-small font-semibold text-pine-600 hover:underline">
        <ArrowLeft className="size-4" /> All mentees
      </Link>
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside>
          <IdentityColumn
            p={p}
            mentorName={me.name}
            flags={<FlagChips flags={flags} pulse={pulse} max={4} />}
            actions={
              <>
                <RecComposer studentId={id} subjects={subjects} />
                <SessionScheduler studentId={id} />
                <Button asChild variant="secondary">
                  <a href={`/api/reports/student/${id}`} target="_blank" rel="noopener">
                    <Download /> Download Student Report
                  </a>
                </Button>
              </>
            }
          />
        </aside>
        <div className="min-w-0">
          <PageHeader title={p.full_name || "Student"} subtitle={`${p.program ?? ""}${p.current_semester ? ` · Semester ${p.current_semester}` : ""}`} />
          <TabStrip
            label="Profile sections"
            active={tab}
            tabs={TABS.map((k) => ({ key: k, label: LABEL[k], href: `${base}?tab=${k}`, count: k === "ask" ? openThreads : k === "mentoring" ? recs.filter((r) => r.status !== "COMPLETED").length : undefined }))}
          />

          {tab === "overview" && (
            <Bento>
              <Card className="md:col-span-3 lg:col-span-5">
                <ChartFrame bare title="CGPA growth rings" table={{ columns: ["Semester", "SGPA", "Credits"], rows: a.semesters.map((s) => [s.semester_no, fmt(s.sgpa), s.credits]) }}>
                  <div className="flex flex-col items-center">
                    <GrowthRings semesters={a.semesters.map((s) => ({ no: s.semester_no, sgpa: s.sgpa, credits: s.credits }))} cgpa={a.cgpa} size={190} />
                  </div>
                </ChartFrame>
              </Card>
              <Card className="md:col-span-3 lg:col-span-7">
                <CardHeader title="SGPA trend" />
                <TrendLine points={a.semesters.map((s) => ({ label: `S${s.semester_no}`, value: s.sgpa }))} max={a.scheme.max_points} height={180} />
              </Card>
              <Card className="md:col-span-6 lg:col-span-7">
                <CardHeader title="Key insights" subtitle="Rule-based, with evidence." />
                <InsightGroups report={report} compact />
              </Card>
              <div className="grid content-start gap-5 md:col-span-6 lg:col-span-5">
                <Card>
                  <CardHeader title="Weekly pulse" subtitle="Self-reported" />
                  <PulseStrip weeks={strip} />
                </Card>
                <Card>
                  <CardHeader title="About" />
                  <KeyValue
                    items={[
                      { k: "Career goals", v: p.career_goals },
                      { k: "Support areas", v: p.support_areas },
                      { k: "Skills", v: p.skills.join(", ") || null },
                      { k: "Interests", v: p.interests.join(", ") || null },
                    ]}
                  />
                </Card>
              </div>
            </Bento>
          )}

          {tab === "academics" &&
            (a.semesters.length ? (
              <div className="grid gap-6">
                {[...a.semesters].reverse().map((s) => (
                  <section key={s.id}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-h3 font-semibold text-ink-900">Semester {s.semester_no}</h2>
                      <StatusPill status={s.status} />
                      <span className="text-small text-ink-500">
                        SGPA {fmt(s.sgpa)} {s.sgpa == null && s.sgpa_reason ? `(${s.sgpa_reason})` : ""} · {s.credits ?? "?"} credits
                      </span>
                      {s.status === "SUBMITTED" && (
                        <Link href="/mentor/verifications" className="text-small font-semibold text-pine-600 hover:underline">
                          Verify →
                        </Link>
                      )}
                    </div>
                    {s.manual ? <p className="text-small text-ink-500">Entered as SGPA only during setup — unverified.</p> : <ResultsTable results={s.results} />}
                  </section>
                ))}
              </div>
            ) : (
              <Card>
                <EmptyState illustration="marks" title="No academic records yet" body="The student hasn't added any semesters." />
              </Card>
            ))}

          {tab === "insights" && <InsightsView a={a} report={report} semester={Number(sp.sem) || null} basePath={`${base}?tab=insights`} owner="mentor" />}

          {tab === "mentoring" && (
            <div className="grid gap-4">
              {recs.length ? recs.map((r) => <RecItem key={r.id} r={r} viewer="MENTOR" />) : (
                <Card>
                  <EmptyState illustration="feedback" title="Nothing yet" body="Write the first recommendation, feedback or goal." action={<RecComposer studentId={id} subjects={subjects} />} />
                </Card>
              )}
            </div>
          )}

          {tab === "resources" && <ResourcesTab studentId={id} mentorId={me.id} students={mentees.map((m) => ({ id: m.user_id, label: m.full_name }))} subjects={subjects} />}

          {tab === "sessions" && <SessionsTab studentId={id} />}

          {tab === "journey" && <SteppingStones events={await loadJourney(id, p.department_id, "mentor")} active={sp.type || null} basePath={`${base}?tab=journey`} />}

          {tab === "pulse" && (
            <div className="grid gap-5">
              <Card>
                <ChartFrame bare title="Pulse strip" table={{ columns: ["Week of", "Mood", "Workload"], rows: pulseRows.map((r) => [r.week_start, MOOD_TEXT[r.mood], r.workload.toLowerCase()]) }}>
                  <CardHeader title="Last 12 weeks" subtitle="Self-reported by the student. Skipped weeks are never a flag." />
                  <PulseStrip weeks={strip} />
                  <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-700">
                    {PULSE_LEGEND.slice(1).map((m) => (
                      <li key={m.label}>{m.glyph} = {m.label}</li>
                    ))}
                    <li>red dot = heavy week · lilac dot = note shared</li>
                  </ul>
                </ChartFrame>
                {pulse.length > 0 && (
                  <div className="mt-4">
                    <FlagChips flags={[]} pulse={pulse} max={5} />
                  </div>
                )}
              </Card>
              {pulseRows.length ? (
                <ul className="grid gap-3">
                  {[...pulseRows].reverse().map((r) => (
                    <li key={r.id} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-1 sm:flex-row sm:items-start">
                      <MoodFace mood={r.mood} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink-900">
                          Week of {fmtDate(r.week_start)} · {MOOD_TEXT[r.mood]} · {r.workload.toLowerCase()} workload
                        </p>
                        {r.subject_confidence?.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {r.subject_confidence.map((c) => (
                              <Chip key={c.subject_id} tone={c.score <= 2 ? "coral" : c.score >= 4 ? "mint" : "neutral"}>
                                {c.subject}: {c.score}/5
                              </Chip>
                            ))}
                          </div>
                        )}
                        {r.help_note && <p className="mt-2 rounded-panel bg-lilac-50 p-3 text-body text-ink-900">“{r.help_note}”</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {r.seen_by_mentor_at ? (
                          <Chip tone="mint">
                            <Eye className="size-3" aria-hidden /> Seen
                          </Chip>
                        ) : (
                          <PulseSeenButton id={r.id} />
                        )}
                        {r.help_note && <RecComposer studentId={id} subjects={subjects} prefill={{ kind: "RECOMMENDATION", title: "About your check-in", body: `You mentioned: “${r.help_note}”\n\n` }} trigger={<Button size="sm" variant="secondary">Reply with a recommendation</Button>} />}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Card>
                  <EmptyState illustration="pulse" title="No Pulse check-ins yet" body="Check-ins are optional and weekly. When the student checks in, it shows here." />
                </Card>
              )}
              <div className="flex flex-wrap gap-2">
                <SessionScheduler studentId={id} label="Suggest a session" />
              </div>
            </div>
          )}

          {tab === "ask" &&
            (threads.length ? (
              <ul className="grid gap-3">
                {threads.map((x) => (
                  <li key={x.id}>
                    <Link href={`/mentor/inbox/${x.id}`} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-1 hover:border-pine-100">
                      <MessageCircleQuestion className="size-5 shrink-0 text-lilac-700" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink-900">{x.title}</span>
                      {x.subject && <Chip>{x.subject.code}</Chip>}
                      <StatusPill status={x.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Card>
                <EmptyState illustration="questions" title="No questions yet" body="When this student asks a question, it shows up here and in your inbox." />
              </Card>
            ))}

          {tab === "plans" && <PlansTab studentId={id} subjects={subjects} />}

          {tab === "report" && (
            <Card>
              <CardHeader title="Student Mentoring Report" icon={FileText} subtitle="A professional PDF from verified records only." />
              <ul className="mb-5 grid gap-1.5 text-body text-ink-700">
                <li>✓ 01 Student information · 02 Academic summary · 03 Semester-wise performance · 04 Mentoring records</li>
                <li>✓ Only verified or finalized semesters, and only shared items marked “Include in report”</li>
                <li>✗ Never includes charts, insights, risk flags, Pulse, planner results or questions</li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <a href={`/api/reports/student/${id}?download=1`}>
                    <Download /> Download PDF
                  </a>
                </Button>
                <Button asChild variant="secondary">
                  <a href={`/api/reports/student/${id}`} target="_blank" rel="noopener">
                    Preview
                  </a>
                </Button>
              </div>
              <p className="mt-4 text-small text-ink-500">
                {a.verified_count} of {a.semesters.length} semesters verified · {recs.filter((r) => r.include_in_report && r.visibility === "SHARED").length} mentoring items marked for the report
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

async function ResourcesTab({ studentId, mentorId, students, subjects }: { studentId: string; mentorId: string; students: { id: string; label: string }[]; subjects: { id: string; label: string }[] }) {
  const list = (await resources({ mentorId })).filter((r) => r.student_id === studentId || r.student_id == null);
  return (
    <div>
      <div className="mb-4">
        <ResourceUploader students={students} subjects={subjects} studentId={studentId} />
      </div>
      {list.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((r) => (
            <ResourceCard key={r.id} r={r} target={r.student_id ? "This student" : "All mentees"} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState illustration="resources" title="No resources shared yet" />
        </Card>
      )}
    </div>
  );
}

async function SessionsTab({ studentId }: { studentId: string }) {
  const list = await sessions({ studentId });
  return list.length ? (
    <div className="grid gap-3">
      {list.map((s) => (
        <SessionCard key={s.id} s={s} who={s.status === "SCHEDULED" ? "Upcoming session" : "Session"} actions={s.status === "SCHEDULED" ? <SessionActions id={s.id} /> : undefined} />
      ))}
    </div>
  ) : (
    <Card>
      <EmptyState illustration="sessions" title="No sessions yet" body="Schedule one from the profile column." />
    </Card>
  );
}

async function PlansTab({ studentId, subjects }: { studentId: string; subjects: { id: string; label: string }[] }) {
  const supabase = await db();
  const { data } = await supabase.from("target_plans").select("id, kind, title, inputs, result, created_at").eq("student_id", studentId).eq("shared_with_mentor", true).order("created_at", { ascending: false });
  if (!data?.length)
    return (
      <Card>
        <EmptyState illustration="plans" title="No shared plans" body="When the student shares a Grade Goal Planner result, it appears here." />
      </Card>
    );
  return (
    <Section title="Shared goal plans" className="mt-0">
      <ul className="grid gap-3">
        {data.map((p) => {
          const r = p.result as Record<string, unknown>;
          const desc = p.kind === "CGPA" ? `Needs an average SGPA of ${Number(r.required).toFixed(2)} (${String(r.state).replace("_", " ").toLowerCase()})` : `Needs at least ${String(r.min_see_marks)}/${String(r.see_max)} in SEE`;
          return (
            <li key={p.id} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-1 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-900">{p.title}</p>
                <p className="text-small text-ink-500">
                  {desc} · shared {fmtDate(p.created_at)}
                </p>
              </div>
              <RecComposer studentId={studentId} subjects={subjects} prefill={{ kind: "GOAL", title: p.title, body: desc, source: "PLANNER", source_id: p.id, target: p.title }} />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
