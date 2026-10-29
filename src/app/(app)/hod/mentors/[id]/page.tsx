import { ArrowLeft, CalendarDays, HeartPulse, LayoutGrid, MessageSquareText, Timer } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, Card, Chip } from "@/components/ui/display";
import { EmptyState, KeyValue, PageHeader, Section, StatTile } from "@/components/ui/layout";
import { CapacityEditor } from "@/features/hod/capacity";
import { MenteeCard } from "@/features/mentor/mentee-card";
import { fmtDate } from "@/lib/dates";
import { fmt } from "@/lib/utils";
import { requirePage } from "@/server/authz";
import { signedUrl } from "@/server/files";
import { mentorActivity } from "@/server/queries/hod";
import { menteeIds } from "@/server/queries/people";
import { roster } from "@/server/queries/roster";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Mentor" };

export default async function HodMentor({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("HOD");
  const { id } = await params;
  const supabase = await db();
  const [{ data: m }, activity, ids] = await Promise.all([supabase.from("mentor_profiles").select("*, users!inner(email, status)").eq("user_id", id).maybeSingle(), mentorActivity(), menteeIds(id)]);
  if (!m) notFound();
  const a = activity.find((x) => x.mentor_id === id);
  const entries = await roster(ids, false);
  const u = (m as unknown as { users: { email: string; status: string } }).users;
  return (
    <>
      <Link href="/hod/mentors" className="mb-3 inline-flex min-h-9 items-center gap-1 text-small font-semibold text-pine-600 hover:underline">
        <ArrowLeft className="size-4" /> Mentors
      </Link>
      <PageHeader
        eyebrow={<Avatar name={m.full_name || "Mentor"} src={await signedUrl("avatars", m.avatar_path)} size={56} ring />}
        title={m.full_name || "Mentor"}
        subtitle={`${m.designation ?? "Mentor"} · ${u.email}`}
        action={
          <Button asChild>
            <Link href={`/hod/assignments?mentor=${id}`}>
              <LayoutGrid /> Manage mentees
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
        <StatTile label="Mentees" value={`${a?.mentees ?? ids.length}/${m.capacity}`} icon={LayoutGrid} tone={(a?.mentees ?? 0) > m.capacity ? "coral" : "mint"} />
        <StatTile label="Feedback in 30 days" value={a?.feedback_30d ?? 0} icon={MessageSquareText} tone="lilac" />
        <StatTile label="Sessions in 30 days" value={a?.sessions_30d ?? 0} icon={CalendarDays} tone="sky" />
        <StatTile label="Median Ask reply" value={a?.median_first_response_hours == null ? "—" : `${fmt(a.median_first_response_hours, 1)} h`} icon={Timer} tone="butter" helper={`Pulse participation ${a?.pulse_participation_pct ?? "—"}%`} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <h2 className="mb-4 font-display text-h3 font-semibold text-ink-900">Profile</h2>
          <KeyValue
            items={[
              { k: "Faculty ID", v: m.faculty_id },
              { k: "Official email", v: m.official_email },
              { k: "Phone", v: m.phone },
              { k: "Last active", v: a?.last_activity ? fmtDate(a.last_activity) : "—" },
            ]}
          />
          {m.expertise?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(m.expertise as string[]).map((e) => (
                <Chip key={e} tone="mint">
                  {e}
                </Chip>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-display text-h3 font-semibold text-ink-900">
            <HeartPulse className="size-5 text-coral-700" aria-hidden /> Load
          </h2>
          <CapacityEditor mentorId={id} capacity={m.capacity} />
          <p className="mt-3 text-small text-ink-500">Capacity guides the assignment board. Ask and Pulse are shown to you only as aggregates.</p>
        </Card>
      </div>
      <Section title={`Assigned mentees (${entries.length})`}>
        {entries.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e) => (
              <MenteeCard key={e.profile.user_id} e={e} href={`/hod/students/${e.profile.user_id}`} showPulse={false} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState compact illustration="mentees" title="No mentees yet" action={<Link href={`/hod/assignments?mentor=${id}`} className="font-semibold text-pine-600 hover:underline">Assign students</Link>} />
          </Card>
        )}
      </Section>
    </>
  );
}
