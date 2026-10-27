import { ArrowRight, CalendarDays, ClipboardCheck, Inbox, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, Card, CardHeader } from "@/components/ui/display";
import { Bento, EmptyState, HeroCard, PageHeader, Section, StatTile } from "@/components/ui/layout";
import { FlagChips } from "@/features/mentor/flags";
import { MenteeCard } from "@/features/mentor/mentee-card";
import { fmtDateTime } from "@/lib/dates";
import { firstName, greeting } from "@/lib/utils";
import { requirePage } from "@/server/authz";
import { listThreads } from "@/server/queries/ask";
import { sessions } from "@/server/queries/mentoring";
import { menteeIds } from "@/server/queries/people";
import { roster } from "@/server/queries/roster";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Home" };

export default async function MentorHome() {
  const me = await requirePage("MENTOR");
  const ids = await menteeIds(me.id);
  const supabase = await db();
  const weekEnd = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const [entries, threads, upcoming, { count: pendingSem }, { count: pendingCr }] = await Promise.all([
    roster(ids, true),
    listThreads({ status: "OPEN", limit: 50 }),
    sessions({ mentorId: me.id, upcoming: true, limit: 20 }),
    supabase.from("academic_semesters").select("id", { count: "exact", head: true }).eq("status", "SUBMITTED").in("student_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("record_change_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING").in("student_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const attention = entries.filter((e) => e.flags.length || e.pulse.length).sort((a, b) => b.flags.length + b.pulse.length - (a.flags.length + a.pulse.length));
  const unanswered = threads.filter((t) => !t.first_response_at);
  const thisWeek = upcoming.filter((s) => s.scheduled_at <= weekEnd);
  const deltas = entries.map((e) => e.sgpaDelta).filter((d): d is number => d != null);
  const avgDelta = deltas.length ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 100) / 100 : null;

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName(me.name)}`} subtitle="Here's how your mentees are doing this week." />
      <Bento>
        <HeroCard className="md:col-span-6 lg:col-span-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="label-caps !text-white/80">Your mentees this semester</p>
              <p className="mt-1 font-display text-[3.5rem] leading-[3.75rem] font-bold tnum">{entries.length}</p>
              <p className="mt-1 text-white/90">
                {avgDelta == null ? "SGPA changes appear once two semesters are in." : `Average SGPA change ${avgDelta >= 0 ? "+" : ""}${avgDelta.toFixed(2)} vs the previous semester`}
              </p>
            </div>
            <Link href="#attention" className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-control bg-white px-4 font-semibold text-pine-700 hover:bg-mint-50 md:self-auto">
              Review needs-attention <ArrowRight className="size-4" />
            </Link>
          </div>
        </HeroCard>
        <div className="col-span-full grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
          <StatTile label="Need attention" value={attention.length} icon={TriangleAlert} tone="coral" href="#attention" helper="With explained reasons" />
          <StatTile label="Unanswered questions" value={unanswered.length} icon={Inbox} tone="lilac" href="/mentor/inbox?filter=unanswered" helper={`${threads.length} open in total`} />
          <StatTile label="Pending verifications" value={(pendingSem ?? 0) + (pendingCr ?? 0)} icon={ClipboardCheck} tone="butter" href="/mentor/verifications" helper={`${pendingCr ?? 0} corrections`} />
          <StatTile label="Sessions this week" value={thisWeek.length} icon={CalendarDays} tone="mint" href="/mentor/sessions" />
        </div>
      </Bento>

      <Bento className="mt-5">
        <Card className="md:col-span-6 lg:col-span-8" id="attention">
          <CardHeader title="Needs attention" icon={TriangleAlert} tone="coral" subtitle="Rule-based flags plus self-reported Pulse signals. Every chip explains itself." />
          {attention.length ? (
            <ul className="grid gap-2">
              {attention.slice(0, 8).map((e) => (
                <li key={e.profile.user_id}>
                  <Link href={`/mentor/mentees/${e.profile.user_id}`} className="flex flex-col gap-2 rounded-panel border border-line p-3 hover:border-pine-100 hover:bg-canvas sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-3 sm:w-56">
                      <Avatar name={e.profile.full_name} src={e.profile.avatar_url} size={36} />
                      <span className="truncate font-semibold text-ink-900">{e.profile.full_name}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <FlagChips flags={e.flags} pulse={e.pulse} max={4} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact illustration="mentees" title="No one flagged right now" body="Flags appear with clear reasons when results drop, records are missing, or a student reports a tough stretch." />
          )}
        </Card>
        <Card className="md:col-span-6 lg:col-span-4">
          <CardHeader title="Agenda" icon={CalendarDays} tone="sky" action={<Link href="/mentor/sessions" className="text-small font-semibold text-pine-600 hover:underline">All →</Link>} />
          {upcoming.length ? (
            <ol className="grid gap-3">
              {upcoming.slice(0, 5).map((s) => (
                <li key={s.id} className="flex items-start gap-3">
                  <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full bg-mint-400" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-900">{s.student_name}</p>
                    <p className="text-small text-ink-500">{fmtDateTime(s.scheduled_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-small text-ink-500">No upcoming sessions.</p>
          )}
        </Card>
      </Bento>

      <Section title="Your mentees" action={<Link href="/mentor/mentees" className="text-small font-semibold text-pine-600 hover:underline">See all →</Link>}>
        {entries.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.slice(0, 6).map((e) => (
              <MenteeCard key={e.profile.user_id} e={e} href={`/mentor/mentees/${e.profile.user_id}`} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState illustration="mentees" title="No mentees assigned yet" body="Your HOD assigns mentees. They'll appear here as soon as they're assigned." />
          </Card>
        )}
      </Section>
    </>
  );
}
