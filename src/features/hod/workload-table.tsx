import Link from "@/components/ui/link";
import { Avatar, Meter } from "@/components/ui/display";
import { fmtDate } from "@/lib/dates";
import { fmt } from "@/lib/utils";
import type { MentorActivity } from "@/server/queries/hod";

/** Mentor workload: table on desktop, cards on mobile. Aggregates only (no Pulse/Ask content). */
export function WorkloadTable({ rows }: { rows: MentorActivity[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-small tnum">
          <caption className="sr-only">Mentor workload</caption>
          <thead className="bg-canvas-sunk text-left text-ink-700">
            <tr>
              <th scope="col" className="rounded-l-panel px-3 py-2.5 font-semibold">Mentor</th>
              <th scope="col" className="w-48 px-3 py-2.5 font-semibold">Mentees / capacity</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Feedback (30 d)</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Sessions (30 d)</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Median Ask reply</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Pulse participation</th>
              <th scope="col" className="rounded-r-panel px-3 py-2.5 font-semibold">Last active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.mentor_id} className="border-b border-line last:border-0">
                <td className="px-3 py-3">
                  <Link href={`/hod/mentors/${m.mentor_id}`} className="flex items-center gap-2 font-semibold text-ink-900 hover:underline">
                    <Avatar name={m.full_name} size={28} /> {m.full_name}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <div className="mb-1 flex justify-between">
                    <span className={m.mentees > m.capacity ? "font-semibold text-coral-700" : "text-ink-900"}>{m.mentees}</span>
                    <span className="text-ink-500">/ {m.capacity}</span>
                  </div>
                  <Meter value={Math.min(m.mentees, m.capacity)} max={m.capacity} label={`${m.full_name} load`} tone={m.mentees > m.capacity ? "coral" : "pine"} />
                </td>
                <td className="px-3 py-3 text-right">{m.feedback_30d}</td>
                <td className="px-3 py-3 text-right">{m.sessions_30d}</td>
                <td className="px-3 py-3 text-right">{m.median_first_response_hours == null ? "—" : `${fmt(m.median_first_response_hours, 1)} h`}</td>
                <td className="px-3 py-3 text-right">{m.pulse_participation_pct == null ? "—" : `${m.pulse_participation_pct}%`}</td>
                <td className="px-3 py-3 text-ink-500">{m.last_activity ? fmtDate(m.last_activity, { day: "numeric", month: "short" }) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-3 md:hidden">
        {rows.map((m) => (
          <li key={m.mentor_id}>
            <Link href={`/hod/mentors/${m.mentor_id}`} className="block rounded-panel border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold text-ink-900">
                  <Avatar name={m.full_name} size={28} /> {m.full_name}
                </span>
                <span className="text-small text-ink-700 tnum">
                  {m.mentees}/{m.capacity}
                </span>
              </div>
              <div className="mt-2">
                <Meter value={Math.min(m.mentees, m.capacity)} max={m.capacity} label={`${m.full_name} load`} tone={m.mentees > m.capacity ? "coral" : "pine"} />
              </div>
              <p className="mt-2 text-small text-ink-500">
                {m.feedback_30d} feedback · {m.sessions_30d} sessions · reply {m.median_first_response_hours == null ? "—" : `${fmt(m.median_first_response_hours, 1)} h`} · Pulse {m.pulse_participation_pct ?? "—"}%
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
