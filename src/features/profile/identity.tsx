import { Mail, Phone } from "lucide-react";
import { Avatar, Card, Chip, Meter } from "@/components/ui/display";
import type { MentorCard as Mentor, StudentProfile } from "@/server/queries/people";
import { fmtDate } from "@/lib/dates";

/** Left sticky identity column on the mentee profile (header card on mobile). */
export function IdentityColumn({ p, mentorName, actions, flags }: { p: StudentProfile; mentorName: string | null; actions?: React.ReactNode; flags?: React.ReactNode }) {
  return (
    <Card className="lg:sticky lg:top-24">
      <div className="flex items-center gap-4 lg:flex-col lg:items-start">
        <Avatar name={p.full_name || "Student"} src={p.avatar_url} size={72} ring />
        <div className="min-w-0">
          <h2 className="truncate font-display text-h3 font-bold text-ink-900 lg:text-display-m">{p.full_name || "New student"}</h2>
          <p className="truncate text-small text-ink-500">{p.program ?? "Program not set"}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {p.usn && <Chip>{p.usn}</Chip>}
        {p.current_semester && <Chip tone="mint">Sem {p.current_semester}</Chip>}
        {p.section && <Chip>Section {p.section}</Chip>}
        <Chip tone="lilac">{mentorName ? `Mentor: ${mentorName}` : "No mentor yet"}</Chip>
      </div>
      {flags && <div className="mt-3">{flags}</div>}
      <div className="mt-5">
        <div className="mb-1.5 flex justify-between text-small">
          <span className="font-semibold text-ink-900">Profile</span>
          <span className="text-ink-700 tnum">{p.profile_completion}% complete</span>
        </div>
        <Meter value={p.profile_completion} label="Profile completion" />
      </div>
      {(p.phone || p.email) && (
        <ul className="mt-5 grid gap-1.5 text-small text-ink-700">
          {p.email && (
            <li className="flex items-center gap-2 truncate">
              <Mail className="size-4 shrink-0 text-ink-500" aria-hidden /> {p.email}
            </li>
          )}
          {p.phone && (
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-ink-500" aria-hidden /> {p.phone}
            </li>
          )}
        </ul>
      )}
      {actions && <div className="mt-5 grid gap-2">{actions}</div>}
    </Card>
  );
}

export function MentorCardView({ m }: { m: Mentor | null }) {
  if (!m)
    return (
      <Card className="bg-canvas-sunk shadow-none">
        <p className="font-semibold text-ink-900">No mentor assigned yet</p>
        <p className="mt-1 text-small text-ink-700">Your HOD assigns mentors. You&apos;ll get a notification as soon as it happens.</p>
      </Card>
    );
  return (
    <Card>
      <p className="label-caps">My mentor</p>
      <div className="mt-3 flex items-center gap-3">
        <Avatar name={m.full_name} src={m.avatar_url} size={52} />
        <div className="min-w-0">
          <p className="truncate font-display text-h3 font-semibold text-ink-900">{m.full_name}</p>
          <p className="truncate text-small text-ink-500">{m.designation ?? "Mentor"}</p>
        </div>
      </div>
      {m.expertise.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {m.expertise.slice(0, 6).map((e) => (
            <Chip key={e} tone="mint">
              {e}
            </Chip>
          ))}
        </div>
      )}
      <ul className="mt-4 grid gap-1.5 text-small text-ink-700">
        {m.official_email && (
          <li className="flex items-center gap-2 truncate">
            <Mail className="size-4 text-ink-500" aria-hidden />
            <a href={`mailto:${m.official_email}`} className="truncate text-pine-600 hover:underline">
              {m.official_email}
            </a>
          </li>
        )}
        {m.phone && (
          <li className="flex items-center gap-2">
            <Phone className="size-4 text-ink-500" aria-hidden /> {m.phone}
          </li>
        )}
      </ul>
      {m.assigned_since && <p className="mt-3 text-small text-ink-500">Your mentor since {fmtDate(m.assigned_since)} · assigned by your HOD</p>}
    </Card>
  );
}
