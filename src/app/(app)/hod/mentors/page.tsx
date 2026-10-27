import { Search, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, Card, Chip, Meter } from "@/components/ui/display";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { fmt } from "@/lib/utils";
import { requirePage } from "@/server/authz";
import { mentorActivity } from "@/server/queries/hod";

export const metadata: Metadata = { title: "Mentors" };

export default async function HodMentors({ searchParams }: { searchParams: Promise<{ q?: string; load?: string; sort?: string }> }) {
  await requirePage("HOD");
  const sp = await searchParams;
  const all = await mentorActivity();
  const q = (sp.q ?? "").toLowerCase();
  let list = all.filter((m) => (!q || m.full_name.toLowerCase().includes(q)) && (!sp.load || (sp.load === "over" ? m.mentees > m.capacity : sp.load === "room" ? m.mentees < m.capacity : m.mentees === 0)));
  if (sp.sort === "load") list = [...list].sort((a, b) => b.mentees / b.capacity - a.mentees / a.capacity);
  return (
    <>
      <PageHeader
        title="Mentors"
        subtitle={`${all.length} mentors · ${all.reduce((x, m) => x + m.mentees, 0)} active assignments`}
        action={
          <Button asChild>
            <Link href="/hod/users?invite=1&role=MENTOR">
              <UserPlus /> Invite a mentor
            </Link>
          </Button>
        }
      />
      <form role="search" className="mb-5 grid gap-3 rounded-card border border-line bg-surface p-3 shadow-1 sm:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative">
          <span className="sr-only">Search mentors</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Search by name" className="pl-9" />
        </label>
        <Select name="load" defaultValue={sp.load ?? ""} aria-label="Load">
          <option value="">Any load</option>
          <option value="over">Over capacity</option>
          <option value="room">Has room</option>
          <option value="none">No mentees</option>
        </Select>
        <Select name="sort" defaultValue={sp.sort ?? ""} aria-label="Sort">
          <option value="">Sort by name</option>
          <option value="load">Sort by load</option>
        </Select>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>
      {list.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => (
            <Link key={m.mentor_id} href={`/hod/mentors/${m.mentor_id}`} className="rounded-card border border-line bg-surface p-4 shadow-1 transition-[transform,box-shadow,border-color] duration-[220ms] ease-grow hover:-translate-y-px hover:border-pine-100 hover:shadow-2">
              <div className="flex items-center gap-3">
                <Avatar name={m.full_name} size={44} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-900">{m.full_name}</p>
                  <p className="truncate text-small text-ink-500">{m.designation ?? "Mentor"}</p>
                </div>
                {m.mentees > m.capacity && (
                  <Chip tone="coral" className="ml-auto">
                    Over capacity
                  </Chip>
                )}
              </div>
              <div className="mt-4 mb-1 flex justify-between text-small">
                <span className="font-semibold text-ink-900 tnum">{m.mentees} mentees</span>
                <span className="text-ink-500 tnum">capacity {m.capacity}</span>
              </div>
              <Meter value={Math.min(m.mentees, m.capacity)} max={m.capacity} label="Load" tone={m.mentees > m.capacity ? "coral" : "pine"} />
              <dl className="mt-4 grid grid-cols-3 gap-2 text-small">
                <div>
                  <dt className="text-ink-500">Feedback</dt>
                  <dd className="font-semibold text-ink-900 tnum">{m.feedback_30d}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Reply</dt>
                  <dd className="font-semibold text-ink-900 tnum">{m.median_first_response_hours == null ? "—" : `${fmt(m.median_first_response_hours, 1)} h`}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Pulse</dt>
                  <dd className="font-semibold text-ink-900 tnum">{m.pulse_participation_pct == null ? "—" : `${m.pulse_participation_pct}%`}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState illustration="mentees" title={all.length ? "No mentors match" : "No mentors yet"} body={all.length ? "Try another filter." : "Invite mentors or import them from a spreadsheet."} />
        </Card>
      )}
    </>
  );
}
