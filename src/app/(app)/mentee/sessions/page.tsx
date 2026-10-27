import type { Metadata } from "next";
import { Card } from "@/components/ui/display";
import { EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { RecItem } from "@/features/mentoring/rec-item";
import { SessionCard } from "@/features/mentoring/session-card";
import { requirePage } from "@/server/authz";
import { recommendations, sessions } from "@/server/queries/mentoring";

export const metadata: Metadata = { title: "Sessions" };

export default async function MenteeSessions() {
  const me = await requirePage("MENTEE");
  const [all, actions] = await Promise.all([sessions({ studentId: me.id }), recommendations({ studentId: me.id, kinds: ["ACTION_POINT"] })]);
  const upcoming = all.filter((s) => s.status === "SCHEDULED" && Date.parse(s.scheduled_at) > Date.now() - 3600_000).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const past = all.filter((s) => !upcoming.includes(s));
  const open = actions.filter((a) => a.status !== "COMPLETED");
  return (
    <>
      <PageHeader title="Sessions" subtitle="Your mentoring meetings and the action items you agreed on." />
      <Section title="Upcoming" className="mt-0">
        {upcoming.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {upcoming.map((s) => (
              <SessionCard key={s.id} s={s} who={`With ${s.mentor_name}`} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState compact illustration="sessions" title="No sessions scheduled" body="Your mentor schedules sessions. You can also ask for one in Ask my mentor." />
          </Card>
        )}
      </Section>
      <Section title={`Agreed action items${open.length ? ` (${open.length} open)` : ""}`}>
        {actions.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {actions.map((a) => (
              <RecItem key={a.id} r={a} viewer="MENTEE" />
            ))}
          </div>
        ) : (
          <p className="text-body text-ink-500">Action items from completed sessions appear here.</p>
        )}
      </Section>
      {past.length > 0 && (
        <Section title="Past sessions">
          <div className="grid gap-3 lg:grid-cols-2">
            {past.map((s) => (
              <SessionCard key={s.id} s={s} who={`With ${s.mentor_name}`} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
