import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { Avatar, Card } from "@/components/ui/display";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { NotifyMentors } from "@/features/hod/notify-mentors";
import { FlagChips } from "@/features/mentor/flags";
import { requirePage } from "@/server/authz";
import { activeAssignments, allStudentIds, mentorActivity } from "@/server/queries/hod";
import { roster } from "@/server/queries/roster";

export const metadata: Metadata = { title: "Interventions" };

const RULES = [
  { k: "", l: "All flags" },
  { k: "declining", l: "Declining" },
  { k: "fail", l: "Failed subject" },
  { k: "repeated-low", l: "Repeated low marks" },
  { k: "missing-results", l: "Missing results" },
  { k: "profile-incomplete", l: "Profile incomplete" },
];

export default async function Interventions({ searchParams }: { searchParams: Promise<{ rule?: string; sem?: string; section?: string }> }) {
  await requirePage("HOD");
  const sp = await searchParams;
  const [ids, asg, mentors] = await Promise.all([allStudentIds(), activeAssignments(), mentorActivity()]);
  const entries = await roster(ids, false, false);
  const mOf = new Map(asg.map((a) => [a.student_id, a.mentor_id]));
  const mName = new Map(mentors.map((m) => [m.mentor_id, m.full_name]));
  const list = entries
    .filter((e) => e.flags.length && (!sp.rule || e.flags.some((f) => f.ruleId === sp.rule)) && (!sp.sem || String(e.profile.current_semester) === sp.sem) && (!sp.section || e.profile.section === sp.section))
    .sort((a, b) => b.flags.length - a.flags.length);
  const byMentor = list.reduce<Record<string, string[]>>((acc, e) => {
    const m = mOf.get(e.profile.user_id);
    if (m) (acc[m] ??= []).push(e.profile.full_name);
    return acc;
  }, {});
  return (
    <>
      <PageHeader
        title="Interventions"
        subtitle="Students with rule-based flags. Every flag explains its reason. Self-reported Pulse data is never shown here."
        action={list.length ? <NotifyMentors groups={Object.entries(byMentor).map(([mentor_id, names]) => ({ mentor_id, names }))} /> : undefined}
      />
      <nav aria-label="Filter by rule" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {RULES.map((r) => (
          <Link key={r.k} href={r.k ? `/hod/interventions?rule=${r.k}` : "/hod/interventions"} aria-current={(sp.rule ?? "") === r.k ? "true" : undefined} className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-small font-semibold text-ink-700 aria-[current=true]:border-pine-600 aria-[current=true]:bg-pine-600 aria-[current=true]:text-white">
            {r.l}
          </Link>
        ))}
      </nav>
      {list.length ? (
        <ul className="grid gap-3">
          {list.map((e) => {
            const m = mOf.get(e.profile.user_id);
            return (
              <li key={e.profile.user_id}>
                <Card className="flex flex-col gap-3 md:flex-row md:items-center">
                  <Link href={`/hod/students/${e.profile.user_id}`} className="flex min-w-0 items-center gap-3 md:w-72">
                    <Avatar name={e.profile.full_name} size={40} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink-900 hover:underline">{e.profile.full_name}</span>
                      <span className="block text-small text-ink-500">{[e.profile.usn, e.profile.current_semester && `Sem ${e.profile.current_semester}`, e.profile.section].filter(Boolean).join(" · ")}</span>
                    </span>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <FlagChips flags={e.flags} max={5} />
                    <ul className="mt-2 grid gap-0.5 text-small text-ink-700">
                      {e.flags.map((f) => (
                        <li key={f.ruleId}>
                          <span className="font-semibold">{f.label}:</span> {f.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-small md:w-48 md:text-right">
                    {m ? (
                      <span className="text-ink-700">
                        Mentor: <span className="font-semibold text-ink-900">{mName.get(m)}</span>
                      </span>
                    ) : (
                      <Link href={`/hod/assignments?student=${e.profile.user_id}`} className="font-semibold text-pine-600 hover:underline">
                        Assign a mentor →
                      </Link>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <EmptyState illustration="mentees" title="No one flagged" body="Students appear here when a rule fires — always with the reason." />
        </Card>
      )}
    </>
  );
}
