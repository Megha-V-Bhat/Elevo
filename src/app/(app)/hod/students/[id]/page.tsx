import { ArrowLeft, Download, History, LayoutGrid } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GrowthRings, TrendLine } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, StatusPill } from "@/components/ui/display";
import { Bento, EmptyState, KeyValue, PageHeader, Section } from "@/components/ui/layout";
import { ResultsTable } from "@/features/academics/results-table";
import { FinalizeButton } from "@/features/hod/finalize";
import { HistoryList } from "@/features/hod/history";
import { InsightGroups } from "@/features/insights/insights-view";
import { FlagChips } from "@/features/mentor/flags";
import { RecItem } from "@/features/mentoring/rec-item";
import { IdentityColumn } from "@/features/profile/identity";
import { fmtDate } from "@/lib/dates";
import { fmt } from "@/lib/utils";
import { requirePage } from "@/server/authz";
import { insightsFrom, loadAcademics, riskFrom, thresholds } from "@/server/queries/academics";
import { recommendations } from "@/server/queries/mentoring";
import { mentorOf, studentProfile } from "@/server/queries/people";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Student" };

/** HOD student view. Deliberately excludes Pulse, Ask and planner content (aggregate-only boundary). */
export default async function HodStudent({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("HOD");
  const { id } = await params;
  const p = await studentProfile(id);
  if (!p) notFound();
  const supabase = await db();
  const [a, t, mentor, recs, { data: history }] = await Promise.all([
    loadAcademics(id, p.department_id),
    thresholds(p.department_id),
    mentorOf(id),
    recommendations({ studentId: id, limit: 20 }),
    supabase.from("mentor_assignments").select("id, mentor_id, started_at, ended_at, reason").eq("student_id", id).order("started_at", { ascending: false }),
  ]);
  const report = insightsFrom(a, t.insight);
  const flags = riskFrom(a, report, { current_semester: p.current_semester, profile_completion: p.profile_completion, created_at: p.created_at }, t.risk);
  const mids = [...new Set((history ?? []).map((h) => h.mentor_id))];
  const { data: mp } = mids.length ? await supabase.from("mentor_profiles").select("user_id, full_name").in("user_id", mids) : { data: [] };
  const mname = new Map((mp ?? []).map((m) => [m.user_id, m.full_name]));
  const recordIds = [...a.semesters.map((s) => s.id), ...a.semesters.flatMap((s) => s.results.map((r) => r.id)), ...(history ?? []).map((h) => h.id)];

  return (
    <>
      <Link href="/hod/students" className="mb-3 inline-flex min-h-9 items-center gap-1 text-small font-semibold text-pine-600 hover:underline">
        <ArrowLeft className="size-4" /> Students
      </Link>
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside>
          <IdentityColumn
            p={p}
            mentorName={mentor?.full_name ?? null}
            flags={<FlagChips flags={flags} max={4} />}
            actions={
              <>
                <Button asChild>
                  <Link href={`/hod/assignments?student=${id}`}>
                    <LayoutGrid /> {mentor ? "Reassign mentor" : "Assign a mentor"}
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <a href={`/api/reports/student/${id}?download=1`}>
                    <Download /> Download Student Report
                  </a>
                </Button>
              </>
            }
          />
        </aside>
        <div className="min-w-0">
          <PageHeader title={p.full_name || "Student"} subtitle="Academic records, shared mentoring items and assignment history. Pulse check-ins and questions stay private to the student and their mentor." />
          <Bento>
            <Card className="md:col-span-3 lg:col-span-5">
              <div className="flex flex-col items-center">
                <GrowthRings semesters={a.semesters.map((s) => ({ no: s.semester_no, sgpa: s.sgpa, credits: s.credits }))} cgpa={a.cgpa} size={180} />
              </div>
            </Card>
            <Card className="md:col-span-3 lg:col-span-7">
              <CardHeader title="SGPA trend" />
              <TrendLine points={a.semesters.map((s) => ({ label: `S${s.semester_no}`, value: s.sgpa }))} max={a.scheme.max_points} height={170} />
            </Card>
          </Bento>
          <Section title="Semesters">
            {a.semesters.length ? (
              <div className="grid gap-6">
                {[...a.semesters].reverse().map((s) => (
                  <div key={s.id}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-h3 font-semibold text-ink-900">Semester {s.semester_no}</h3>
                      <StatusPill status={s.status} />
                      <span className="text-small text-ink-500">SGPA {fmt(s.sgpa)}</span>
                      <span className="ml-auto">
                        <FinalizeButton id={s.id} status={s.status} />
                      </span>
                    </div>
                    {s.manual ? <p className="text-small text-ink-500">Entered as SGPA only — unverified.</p> : <ResultsTable results={s.results} />}
                  </div>
                ))}
              </div>
            ) : (
              <Card>
                <EmptyState compact illustration="marks" title="No records yet" />
              </Card>
            )}
          </Section>
          <Section title="Insights">
            <InsightGroups report={report} />
          </Section>
          <Section title="Shared mentoring items">
            {recs.length ? (
              <div className="grid gap-3">
                {recs.map((r) => (
                  <RecItem key={r.id} r={r} viewer="MENTEE" />
                ))}
              </div>
            ) : (
              <p className="text-small text-ink-500">Nothing shared yet.</p>
            )}
          </Section>
          <Section title="About">
            <Card>
              <KeyValue items={[{ k: "Career goals", v: p.career_goals }, { k: "Skills", v: p.skills.join(", ") || null }, { k: "Admission year", v: p.admission_year }, { k: "Expected graduation", v: p.expected_graduation_year }]} />
            </Card>
          </Section>
          <Section title="Assignment history">
            <Card>
              {history?.length ? (
                <ol className="grid gap-2">
                  {history.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-panel bg-canvas-sunk px-3 py-2 text-small">
                      <span className="font-semibold text-ink-900">{mname.get(h.mentor_id) ?? "Mentor"}</span>
                      <span className="text-ink-700">
                        {fmtDate(h.started_at)} → {h.ended_at ? fmtDate(h.ended_at) : "now"}
                        {h.reason ? ` · ${h.reason}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-small text-ink-500">Never assigned.</p>
              )}
            </Card>
          </Section>
          <Section title="Change history">
            <details className="rounded-card border border-line bg-surface p-4 shadow-1">
              <summary className="flex cursor-pointer items-center gap-2 font-semibold text-ink-900">
                <History className="size-4" aria-hidden /> Show audit history for this student&apos;s records
              </summary>
              <div className="mt-3">
                <HistoryList entityIds={recordIds} />
              </div>
            </details>
          </Section>
        </div>
      </div>
    </>
  );
}
