import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/display";
import { EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { SessionActions, SessionScheduler } from "@/features/mentor/composers";
import { SessionCard } from "@/features/mentoring/session-card";
import { fmtDate } from "@/lib/dates";
import { requirePage } from "@/server/authz";
import { sessions } from "@/server/queries/mentoring";
import { menteeProfiles } from "@/server/queries/people";

export const metadata: Metadata = { title: "Sessions" };

export default async function MentorSessions() {
  const me = await requirePage("MENTOR");
  const [all, mentees] = await Promise.all([sessions({ mentorId: me.id, limit: 200 }), menteeProfiles(me.id)]);
  const now = Date.now() - 3600_000;
  const upcoming = all.filter((s) => s.status === "SCHEDULED" && Date.parse(s.scheduled_at) >= now).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const needsSummary = all.filter((s) => s.status === "SCHEDULED" && Date.parse(s.scheduled_at) < now);
  const past = all.filter((s) => s.status !== "SCHEDULED");
  const followUps = past.filter((s) => s.next_follow_up_date).sort((a, b) => (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? ""));
  const byDay = upcoming.reduce<Record<string, typeof upcoming>>((m, s) => {
    const d = fmtDate(s.scheduled_at, { weekday: "long", day: "numeric", month: "long" });
    (m[d] ??= []).push(s);
    return m;
  }, {});
  const students = mentees.map((m) => ({ id: m.user_id, label: m.full_name || m.usn || "Student" }));
  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle="Your agenda, sessions that need a summary, and follow-ups."
        action={
          <Suspense>
            <SessionScheduler students={students} autoOpenParam="new" />
          </Suspense>
        }
      />
      {needsSummary.length > 0 && (
        <Section title={`Add a summary (${needsSummary.length})`} className="mt-0 mb-8">
          <div className="grid gap-3 lg:grid-cols-2">
            {needsSummary.map((s) => (
              <SessionCard key={s.id} s={s} who={s.student_name ?? "Student"} actions={<SessionActions id={s.id} />} />
            ))}
          </div>
        </Section>
      )}
      <Section title="Agenda" className="mt-0">
        {Object.keys(byDay).length ? (
          <div className="grid gap-6">
            {Object.entries(byDay).map(([day, list]) => (
              <div key={day}>
                <h3 className="label-caps mb-2">{day}</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {list.map((s) => (
                    <SessionCard key={s.id} s={s} who={s.student_name ?? "Student"} actions={<SessionActions id={s.id} />} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState compact illustration="sessions" title="No upcoming sessions" body="Schedule one with any of your mentees." />
          </Card>
        )}
      </Section>
      {followUps.length > 0 && (
        <Section title="Follow-ups">
          <ul className="grid gap-2">
            {followUps.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-panel border border-line bg-surface px-4 py-3">
                <span className="font-semibold text-ink-900">{s.student_name}</span>
                <span className={`text-small ${Date.parse(s.next_follow_up_date!) < Date.now() ? "font-semibold text-coral-700" : "text-ink-500"}`}>Follow up by {fmtDate(s.next_follow_up_date)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {past.length > 0 && (
        <Section title="Past sessions">
          <div className="grid gap-3 lg:grid-cols-2">
            {past.slice(0, 20).map((s) => (
              <SessionCard key={s.id} s={s} who={s.student_name ?? "Student"} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
