import { CalendarPlus, Clock, MapPin, Video } from "lucide-react";
import { StatusPill } from "@/components/ui/display";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import type { SessionRow } from "@/server/queries/mentoring";

export function SessionCard({ s, who, actions }: { s: SessionRow; who: string; actions?: React.ReactNode }) {
  const d = new Date(s.scheduled_at);
  return (
    <article className="flex gap-4 rounded-card border border-line bg-surface p-4 shadow-1">
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-panel bg-mint-50 py-2 text-pine-700">
        <span className="label-caps !text-pine-700">{fmtDate(s.scheduled_at, { month: "short" })}</span>
        <span className="font-display text-display-m font-bold tnum">{fmtDate(s.scheduled_at, { day: "numeric" })}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-ink-900">{who}</h3>
          <StatusPill status={s.status} />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-700">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden /> {fmtDateTime(s.scheduled_at)} · {s.duration_min} min
          </span>
          <span className="inline-flex items-center gap-1">
            {s.mode === "ONLINE" ? <Video className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
            {s.mode === "ONLINE" && s.location_or_link?.startsWith("http") ? (
              <a href={s.location_or_link} target="_blank" rel="noopener noreferrer" className="font-semibold text-pine-600 hover:underline">
                Join link
              </a>
            ) : (
              (s.location_or_link ?? (s.mode === "ONLINE" ? "Online" : "In person"))
            )}
          </span>
        </p>
        {s.agenda && <p className="mt-2 text-small text-ink-700"><span className="font-semibold text-ink-900">Agenda:</span> {s.agenda}</p>}
        {s.summary && <p className="mt-2 text-small text-ink-700"><span className="font-semibold text-ink-900">Summary:</span> {s.summary}</p>}
        {s.action_items?.length > 0 && (
          <ul className="mt-2 grid gap-1 text-small text-ink-700">
            {s.action_items.map((a, i) => (
              <li key={i}>• {a.label}</li>
            ))}
          </ul>
        )}
        {s.next_follow_up_date && <p className="mt-2 text-small text-ink-500">Follow-up by {fmtDate(s.next_follow_up_date)}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {s.status === "SCHEDULED" && d.getTime() > Date.now() - 3600_000 && (
            <a href={`/api/sessions/${s.id}/ics`} className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line px-3 text-small font-semibold text-ink-900 hover:bg-pine-50">
              <CalendarPlus className="size-4" /> Add to calendar
            </a>
          )}
          {actions}
        </div>
      </div>
    </article>
  );
}
