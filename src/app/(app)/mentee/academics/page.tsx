import { ChevronRight, CircleHelp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CreditPath, GrowthRings, RingLegend, sgpaBand } from "@/components/charts";
import { Card, Chip, StatusPill } from "@/components/ui/display";
import { EmptyState, HeroCard, PageHeader } from "@/components/ui/layout";
import { AddSemesterButton } from "@/features/academics/semester-actions";
import { fmt } from "@/lib/utils";
import { requirePage } from "@/server/authz";
import { loadAcademics } from "@/server/queries/academics";
import { studentProfile } from "@/server/queries/people";
import { appSettings } from "@/server/queries/settings";

export const metadata: Metadata = { title: "Academics" };

export default async function AcademicsPage() {
  const me = await requirePage("MENTEE");
  const [a, profile, settings] = await Promise.all([loadAcademics(me.id, me.department_id), studentProfile(me.id), appSettings()]);
  const add = (
    <Suspense>
      <AddSemesterButton existing={a.semesters.map((s) => s.semester_no)} current={profile?.current_semester ?? null} />
    </Suspense>
  );
  return (
    <>
      <PageHeader title="Academics" subtitle="Semester-wise marks, grades, SGPA and CGPA. Submit a semester when it's complete so your mentor can verify it." action={add} />
      {a.semesters.length === 0 ? (
        <Card>
          <EmptyState illustration="marks" title="No marks yet" body="Add your first semester. Subjects are pre-filled from your department's catalog, so it only takes a few minutes." action={add} />
        </Card>
      ) : (
        <>
          <HeroCard>
            <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
              <div className="mx-auto">
                <GrowthRings semesters={a.semesters.map((s) => ({ no: s.semester_no, sgpa: s.sgpa, credits: s.credits }))} cgpa={a.cgpa} size={210} onPine />
              </div>
              <div className="md:max-w-[34rem]">
                <p className="label-caps !text-white">Cumulative</p>
                <p className="mt-1 font-display text-display-l font-bold tnum">{a.cgpa == null ? "CGPA not calculated yet" : `${a.cgpa.toFixed(2)} CGPA`}</p>
                <p className="mt-1 text-white">
                  {a.cgpa == null ? a.cgpa_reason : `Across ${a.semesters.filter((s) => s.sgpa != null).length} semesters · ${a.earned_credits} credits · ${a.verified_count} verified`}
                </p>
                <div className="mt-4">
                  <RingLegend onPine />
                </div>
                <p className="mt-3 flex items-start gap-1.5 text-small text-white">
                  <CircleHelp className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Each ring is one semester, innermost first. Thicker rings carry more credits.
                </p>
              </div>
            </div>
          </HeroCard>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {a.semesters.map((s) => (
              <Link
                key={s.id}
                href={`/mentee/academics/${s.semester_no}`}
                className="group rounded-card border border-line bg-surface p-5 shadow-1 transition-[transform,box-shadow,border-color] duration-[220ms] ease-grow hover:-translate-y-px hover:border-pine-100 hover:shadow-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="label-caps">{s.academic_year ?? "Academic year not set"}</p>
                    <h2 className="mt-1 font-display text-h3 font-semibold text-ink-900">Semester {s.semester_no}</h2>
                  </div>
                  <StatusPill status={s.status} />
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="font-display text-display-m font-bold text-ink-900 tnum">{fmt(s.sgpa)}</p>
                    <p className="text-small text-ink-500">{s.sgpa == null ? (s.sgpa_reason ?? "SGPA not calculated") : "SGPA"}</p>
                  </div>
                  <span aria-hidden className="h-10 w-2 rounded-full" style={{ background: sgpaBand(s.sgpa).color }} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-small text-ink-700">
                  <span>{s.manual ? "Entered as SGPA" : `${s.results.length} subjects`}</span>
                  <span aria-hidden>·</span>
                  <span className="tnum">{s.credits ?? "?"} credits</span>
                  {s.manual && <Chip tone="butter">Unverified</Chip>}
                  <ChevronRight className="ml-auto size-4 text-ink-500 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
              </Link>
            ))}
          </div>

          <Card className="mt-6">
            <h2 className="mb-4 font-display text-h3 font-semibold text-ink-900">Credit path</h2>
            <CreditPath
              earned={a.semesters.filter((s) => s.status === "VERIFIED" || s.status === "FINALIZED").reduce((x, s) => x + (s.credits ?? 0), 0)}
              inProgress={a.semesters.filter((s) => s.status === "DRAFT" || s.status === "SUBMITTED").reduce((x, s) => x + (s.credits ?? 0), 0)}
              total={settings.program_total_credits}
            />
            <p className="mt-3 text-small text-ink-500">Earned counts verified semesters. Your programme carries {settings.program_total_credits} credits in total.</p>
          </Card>
        </>
      )}
    </>
  );
}
