import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, Card, Chip } from "@/components/ui/display";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { TabStrip } from "@/components/ui/tabs";
import { ResultsTable } from "@/features/academics/results-table";
import { BulkVerifyList } from "@/features/mentor/verify-list";
import { DecideRequest } from "@/features/mentor/verify-queue";
import { fmtDate } from "@/lib/dates";
import { fmt } from "@/lib/utils";
import { requirePage } from "@/server/authz";
import { loadAcademics } from "@/server/queries/academics";
import { menteeIds } from "@/server/queries/people";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Verifications" };

const LABEL: Record<string, string> = { mse_marks: "MSE", see_marks: "SEE", grade_points: "Grade points", grade: "Grade" };

export default async function Verifications({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requirePage("MENTOR");
  const tab = (await searchParams).tab === "corrections" ? "corrections" : "semesters";
  const ids = await menteeIds(me.id);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const supabase = await db();
  const [{ data: sems }, { data: crs }, { data: profiles }] = await Promise.all([
    supabase.from("academic_semesters").select("id, student_id, semester_no, submitted_at").eq("status", "SUBMITTED").in("student_id", ids.length ? ids : none).order("submitted_at"),
    supabase.from("record_change_requests").select("id, student_id, target_id, proposed, reason, created_at").eq("status", "PENDING").in("student_id", ids.length ? ids : none).order("created_at"),
    supabase.from("student_profiles").select("user_id, full_name, usn, department_id").in("user_id", ids.length ? ids : none),
  ]);
  const prof = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const students = [...new Set([...(sems ?? []).map((s) => s.student_id), ...(crs ?? []).map((c) => c.student_id)])];
  const academics = new Map(await Promise.all(students.map(async (sid) => [sid, await loadAcademics(sid, prof.get(sid)?.department_id ?? null)] as const)));

  return (
    <>
      <PageHeader title="Verifications" subtitle="Check submitted semesters against marks cards, and decide on correction requests. Only your current mentees appear here." />
      <TabStrip
        label="Verification queues"
        active={tab}
        tabs={[
          { key: "semesters", label: "Submitted semesters", href: "/mentor/verifications", count: sems?.length ?? 0 },
          { key: "corrections", label: "Correction requests", href: "/mentor/verifications?tab=corrections", count: crs?.length ?? 0 },
        ]}
      />
      {tab === "semesters" ? (
        sems?.length ? (
          <BulkVerifyList
            items={sems.map((s) => {
              const a = academics.get(s.student_id)!;
              const sem = a.semesters.find((x) => x.id === s.id)!;
              const p = prof.get(s.student_id);
              return {
                id: s.id,
                label: `${p?.full_name ?? "Student"} · Semester ${s.semester_no}`,
                header: (
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar name={p?.full_name ?? "Student"} size={36} />
                    <div>
                      <Link href={`/mentor/mentees/${s.student_id}?tab=academics`} className="font-semibold text-ink-900 hover:underline">
                        {p?.full_name}
                      </Link>
                      <p className="text-small text-ink-500">
                        {p?.usn} · Semester {s.semester_no} · submitted {fmtDate(s.submitted_at)}
                      </p>
                    </div>
                    <Chip tone="mint" className="ml-auto">
                      Draft SGPA {fmt(sem?.sgpa)}
                    </Chip>
                  </div>
                ),
                body: sem ? <ResultsTable results={sem.results} /> : null,
              };
            })}
          />
        ) : (
          <Card>
            <EmptyState illustration="marks" title="Nothing to verify" body="When a mentee submits a semester, it appears here." />
          </Card>
        )
      ) : crs?.length ? (
        <ul className="grid gap-4">
          {crs.map((c) => {
            const a = academics.get(c.student_id);
            const sem = a?.semesters.find((s) => s.results.some((r) => r.id === c.target_id));
            const r = sem?.results.find((x) => x.id === c.target_id);
            const p = prof.get(c.student_id);
            const proposed = c.proposed as Record<string, number | string | null>;
            return (
              <li key={c.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <Avatar name={p?.full_name ?? "Student"} size={32} />
                    <span className="font-semibold text-ink-900">{p?.full_name}</span>
                    <span className="text-small text-ink-500">
                      {r?.subject.code} {r?.subject.name} · Semester {sem?.semester_no} · {fmtDate(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-3 text-body text-ink-700">
                    <span className="font-semibold text-ink-900">Reason:</span> {c.reason}
                  </p>
                  <div className="mt-3 overflow-x-auto rounded-panel border border-line">
                    <table className="w-full text-small tnum">
                      <caption className="sr-only">Current versus proposed values</caption>
                      <thead className="bg-canvas-sunk text-left">
                        <tr>
                          <th scope="col" className="px-3 py-2 font-semibold">Field</th>
                          <th scope="col" className="px-3 py-2 font-semibold">Current</th>
                          <th scope="col" className="px-3 py-2 font-semibold">Proposed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(proposed).map(([k, v]) => (
                          <tr key={k} className="border-t border-line">
                            <td className="px-3 py-2 text-ink-700">{LABEL[k] ?? k}</td>
                            <td className="px-3 py-2 text-coral-700 line-through">{String((r as unknown as Record<string, unknown>)?.[k] ?? "—")}</td>
                            <td className="px-3 py-2 font-semibold text-pine-700">{String(v ?? "—")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 max-w-md">
                    <DecideRequest id={c.id} />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <EmptyState illustration="marks" title="No correction requests" body="Students request corrections on verified records; you'll decide them here." />
        </Card>
      )}
    </>
  );
}
