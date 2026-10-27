import type { Metadata } from "next";
import { Card } from "@/components/ui/display";
import { EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { Planner } from "@/features/planner/planner";
import { SavedPlans, type SavedPlan } from "@/features/planner/saved-plans";
import { requirePage } from "@/server/authz";
import { loadAcademics, subjectCatalog } from "@/server/queries/academics";
import { studentProfile } from "@/server/queries/people";
import { appSettings } from "@/server/queries/settings";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Grade Goal Planner" };

export default async function PlannerPage() {
  const me = await requirePage("MENTEE");
  const supabase = await db();
  const [a, profile, settings, catalog, { data: plans }] = await Promise.all([
    loadAcademics(me.id, me.department_id),
    studentProfile(me.id),
    appSettings(),
    subjectCatalog(me.department_id),
    supabase.from("target_plans").select("id, kind, title, result, shared_with_mentor, created_at").eq("student_id", me.id).order("created_at", { ascending: false }),
  ]);
  const cur = profile?.current_semester ?? null;
  const doneSems = new Set(a.semesters.filter((s) => s.sgpa != null).map((s) => s.semester_no));
  const remainingSems = Array.from({ length: 8 }, (_, i) => i + 1)
    .filter((n) => !doneSems.has(n) && (cur == null || n >= cur))
    .map((n) => {
      const c = catalog.filter((s) => s.semester === n).reduce((x, s) => x + (s.credits ?? 0), 0);
      return { label: `Sem ${n}`, credits: c };
    });
  const known = remainingSems.every((s) => s.credits > 0) && remainingSems.length > 0;
  const remainingGuess = known ? remainingSems.reduce((x, s) => x + s.credits, 0) : Math.max(0, settings.program_total_credits - a.earned_credits) || null;
  const evenSplit = remainingGuess && remainingSems.length ? remainingSems.map((s) => ({ ...s, credits: known ? s.credits : Math.round(remainingGuess / remainingSems.length) })) : [];
  const curSem = a.semesters.find((s) => s.semester_no === cur);
  const subjects = (curSem?.results ?? [])
    .filter((r) => r.subject.has_see && (!r.subject.has_mse || r.mse_marks != null))
    .map((r) => ({ id: r.subject.id, name: r.subject.name, code: r.subject.code, has_mse: r.subject.has_mse, mse_marks: r.mse_marks, mse_max: r.mse_max, see_max: r.see_max, ia: r.ia }));

  return (
    <>
      <PageHeader title="Grade Goal Planner" subtitle="See exactly what it takes to reach your goal. You're only ever compared with your own targets." />
      <Planner
        earned_credits={a.earned_credits}
        current_points={a.current_points}
        cgpa={a.cgpa}
        best_sgpa={a.best_sgpa}
        scheme={a.scheme}
        remaining_guess={remainingGuess}
        remaining_semesters={evenSplit}
        subjects={subjects}
      />
      <Section title="Saved plans">
        {plans?.length ? (
          <SavedPlans plans={plans as SavedPlan[]} />
        ) : (
          <Card>
            <EmptyState compact illustration="plans" title="No plans yet" body="Save a plan to track it, or share it so your mentor can turn it into a goal with you." />
          </Card>
        )}
      </Section>
    </>
  );
}
