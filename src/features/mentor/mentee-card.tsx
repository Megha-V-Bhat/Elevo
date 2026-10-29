import Link from "@/components/ui/link";
import { PulseStrip, Sparkline } from "@/components/charts";
import { Avatar, DeltaChip } from "@/components/ui/display";
import { fmt } from "@/lib/utils";
import type { RosterEntry } from "@/server/queries/roster";
import { FlagChips } from "./flags";

export function MenteeCard({ e, href, showPulse = true }: { e: RosterEntry; href: string; showPulse?: boolean }) {
  const p = e.profile;
  return (
    <Link href={href} className="flex flex-col rounded-card border border-line bg-surface p-4 shadow-1 transition-[transform,box-shadow,border-color] duration-[220ms] ease-grow hover:-translate-y-px hover:border-pine-100 hover:shadow-2">
      <div className="flex items-center gap-3">
        <Avatar name={p.full_name || "Student"} src={p.avatar_url} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink-900">{p.full_name || "New student"}</p>
          <p className="truncate text-small text-ink-500">{[p.usn, p.current_semester && `Sem ${p.current_semester}`, p.section].filter(Boolean).join(" · ")}</p>
        </div>
        <Sparkline values={e.academics.semesters.map((s) => s.sgpa)} label={`SGPA trend for ${p.full_name}`} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="font-display text-h3 font-bold text-ink-900 tnum">{fmt(e.academics.cgpa)}</p>
          <p className="text-small text-ink-500">CGPA</p>
        </div>
        {e.sgpaDelta != null ? <DeltaChip value={e.sgpaDelta} label="SGPA vs prev" /> : <span className="text-small text-ink-500">Latest SGPA {fmt(e.latestSgpa)}</span>}
      </div>
      {showPulse && (
        <div className="mt-3">
          <PulseStrip weeks={e.strip} compact />
        </div>
      )}
      {(e.flags.length > 0 || e.pulse.length > 0) && (
        <div className="mt-3">
          <FlagChips flags={e.flags} pulse={e.pulse} max={2} />
        </div>
      )}
    </Link>
  );
}
