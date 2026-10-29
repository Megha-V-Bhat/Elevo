import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/display";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { RecComposer } from "@/features/mentor/composers";
import { RecItem } from "@/features/mentoring/rec-item";
import { requirePage } from "@/server/authz";
import { subjectCatalog } from "@/server/queries/academics";
import { recommendations } from "@/server/queries/mentoring";
import { menteeProfiles } from "@/server/queries/people";

export const metadata: Metadata = { title: "Recommendations" };

export default async function MentorRecs({ searchParams }: { searchParams: Promise<{ status?: string; kind?: string }> }) {
  const me = await requirePage("MENTOR");
  const sp = await searchParams;
  const [mentees, catalog] = await Promise.all([menteeProfiles(me.id), subjectCatalog(me.department_id)]);
  const ids = new Set(mentees.map((m) => m.user_id));
  const names = new Map(mentees.map((m) => [m.user_id, m.full_name]));
  const all = (await recommendations({ mentorId: me.id, limit: 300 })).filter((r) => ids.has(r.student_id));
  const list = all.filter((r) => (!sp.status || r.status === sp.status) && (!sp.kind || r.kind === sp.kind));
  const chip = (k: string, v: string, l: string) => {
    const p = new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), ...(sp.kind ? { kind: sp.kind } : {}) });
    if ((sp as Record<string, string | undefined>)[k] === v || !v) p.delete(k);
    else p.set(k, v);
    const on = ((sp as Record<string, string | undefined>)[k] ?? "") === v;
    return (
      <Link key={k + v} href={`/mentor/recommendations${p.size ? `?${p}` : ""}`} aria-current={on ? "true" : undefined} className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-line bg-surface px-3.5 text-small font-semibold text-ink-700 aria-[current=true]:border-pine-600 aria-[current=true]:bg-pine-600 aria-[current=true]:text-white">
        {l}
      </Link>
    );
  };
  return (
    <>
      <PageHeader
        title="Recommendations"
        subtitle="Feedback, goals and action points across your current mentees."
        action={
          <Suspense>
            <RecComposer students={mentees.map((m) => ({ id: m.user_id, label: m.full_name }))} subjects={catalog.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }))} autoOpenParam="new" />
          </Suspense>
        }
      />
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {chip("status", "", "All statuses")}
        {chip("status", "PENDING", "Pending")}
        {chip("status", "IN_PROGRESS", "In progress")}
        {chip("status", "COMPLETED", "Completed")}
      </div>
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {chip("kind", "", "All types")}
        {chip("kind", "FEEDBACK", "Feedback")}
        {chip("kind", "RECOMMENDATION", "Recommendations")}
        {chip("kind", "GOAL", "Goals")}
        {chip("kind", "ACTION_POINT", "Action points")}
      </div>
      {list.length ? (
        <div className="grid gap-4">
          {list.map((r) => (
            <div key={r.id}>
              <Link href={`/mentor/mentees/${r.student_id}?tab=mentoring`} className="mb-1.5 inline-block text-small font-semibold text-pine-600 hover:underline">
                {names.get(r.student_id)}
              </Link>
              <RecItem r={r} viewer="MENTOR" />
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState illustration="feedback" title="Nothing here yet" body="Write a recommendation, piece of feedback or goal for any of your mentees." />
        </Card>
      )}
    </>
  );
}
