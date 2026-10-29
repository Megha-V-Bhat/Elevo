import { fmtDate } from "@/lib/dates";
import { ArrowLeft, Clock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Card, Chip, StatusPill } from "@/components/ui/display";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { CorrectionButton } from "@/features/academics/correction";
import { MarksGrid, WithdrawButton } from "@/features/academics/marks-grid";
import { ResultsTable } from "@/features/academics/results-table";
import { fmt } from "@/lib/utils";
import { requirePage } from "@/server/authz";
import { loadAcademics, subjectCatalog } from "@/server/queries/academics";
import { db } from "@/server/supabase";

export async function generateMetadata({ params }: { params: Promise<{ semester: string }> }): Promise<Metadata> {
  return { title: `Semester ${(await params).semester}` };
}

export default async function SemesterPage({ params }: { params: Promise<{ semester: string }> }) {
  const me = await requirePage("MENTEE");
  const no = Number((await params).semester);
  const a = await loadAcademics(me.id, me.department_id);
  const s = a.semesters.find((x) => x.semester_no === no);
  if (!s) notFound();
  const supabase = await db();
  const { data: requests } = await supabase
    .from("record_change_requests")
    .select("id, target_id, status, reason, reviewer_note, created_at")
    .eq("student_id", me.id)
    .in("target_id", s.results.map((r) => r.id).length ? s.results.map((r) => r.id) : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });
  const pendingFor = new Set((requests ?? []).filter((r) => r.status === "PENDING").map((r) => r.target_id));
  const catalog = s.status === "DRAFT" ? await subjectCatalog(me.department_id) : [];

  return (
    <>
      <Link href="/mentee/academics" className="mb-3 inline-flex min-h-9 items-center gap-1 text-small font-semibold text-pine-600 hover:underline">
        <ArrowLeft className="size-4" /> All semesters
      </Link>
      <PageHeader
        title={`Semester ${s.semester_no}`}
        eyebrow={<StatusPill status={s.status} />}
        subtitle={
          s.status === "DRAFT"
            ? "Enter marks as they arrive. Submit when the semester is complete."
            : s.status === "SUBMITTED"
              ? "Waiting for your mentor to verify. Withdraw if you need to change something."
              : "Verified records are locked. Request a correction if something is wrong."
        }
        action={s.status === "SUBMITTED" ? <WithdrawButton semesterId={s.id} /> : undefined}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { k: "SGPA", v: fmt(s.sgpa), sub: s.sgpa == null ? s.sgpa_reason : s.manual ? "Entered manually" : "Credit-weighted" },
          { k: "Credits", v: s.credits ?? "—", sub: `${s.credits_earned} earned` },
          { k: "Subjects", v: s.results.length, sub: `${s.results.filter((r) => r.result === "PASS").length} passed` },
          { k: "Academic year", v: s.academic_year ?? "—", sub: s.verified_at ? `Verified ${fmtDate(s.verified_at)}` : "Not verified yet" },
        ].map((x) => (
          <div key={x.k} className="rounded-card border border-line bg-surface p-4 shadow-1">
            <p className="label-caps">{x.k}</p>
            <p className="mt-1 font-display text-display-m font-bold text-ink-900 tnum">{x.v}</p>
            <p className="truncate text-small text-ink-500" title={x.sub ?? undefined}>{x.sub}</p>
          </div>
        ))}
      </div>

      {s.manual ? (
        <Card>
          <EmptyState illustration="marks" title="Entered as SGPA only" body="This semester was added as an SGPA during setup. Your mentor will check it against your marks card." compact />
        </Card>
      ) : s.status === "DRAFT" ? (
        <MarksGrid
          semesterId={s.id}
          semesterNo={s.semester_no}
          scheme={a.scheme}
          catalog={catalog.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
          rows={s.results.map((r) => ({
            id: r.id,
            subject_id: r.subject.id,
            code: r.subject.code,
            name: r.subject.name,
            credits: r.subject.credits,
            has_mse: r.subject.has_mse,
            has_see: r.subject.has_see,
            mse_max: r.mse_max,
            see_max: r.see_max,
            mse_marks: r.mse_marks,
            see_marks: r.see_marks,
            grade_points: r.grade_points,
            grade: r.grade,
          }))}
        />
      ) : (
        <ResultsTable
          results={s.results}
          action={
            s.status === "VERIFIED" || s.status === "FINALIZED"
              ? (r) =>
                  pendingFor.has(r.id) ? (
                    <Chip tone="butter">
                      <Clock className="size-3" aria-hidden /> Correction pending
                    </Chip>
                  ) : (
                    <CorrectionButton resultId={r.id} subject={r.subject.name} current={{ mse_marks: r.mse_marks, see_marks: r.see_marks, grade_points: r.grade_points }} />
                  )
              : undefined
          }
        />
      )}

      {(requests ?? []).length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 font-display text-h3 font-semibold text-ink-900">
            <ShieldCheck className="size-5 text-pine-600" aria-hidden /> Correction requests
          </h2>
          <ul className="grid gap-2">
            {(requests ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-panel bg-canvas-sunk px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900">{s.results.find((x) => x.id === r.target_id)?.subject.name}</p>
                  <p className="text-small text-ink-700">{r.reason}</p>
                  {r.reviewer_note && <p className="text-small text-ink-500">Mentor: {r.reviewer_note}</p>}
                </div>
                <StatusPill status={r.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
