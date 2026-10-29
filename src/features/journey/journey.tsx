import { CalendarCheck2, CheckCircle2, GraduationCap, Lightbulb, MessageCircleQuestion, Target } from "lucide-react";
import Link from "@/components/ui/link";
import { Card } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/layout";
import { fmtDate } from "@/lib/dates";
import { cn, fmt } from "@/lib/utils";
import { loadAcademics } from "@/server/queries/academics";
import { listThreads } from "@/server/queries/ask";
import { recommendations, sessions } from "@/server/queries/mentoring";

export type JourneyEvent = { id: string; date: string; type: "semester" | "feedback" | "goal" | "action" | "session" | "question"; title: string; detail?: string; href?: string };

const TYPES = {
  semester: { label: "Results", icon: GraduationCap, cls: "text-pine-600 bg-mint-50" },
  feedback: { label: "Feedback", icon: Lightbulb, cls: "text-lilac-700 bg-lilac-50" },
  goal: { label: "Goals", icon: Target, cls: "text-pine-700 bg-pine-50" },
  action: { label: "Actions", icon: CheckCircle2, cls: "text-butter-800 bg-butter-50" },
  session: { label: "Sessions", icon: CalendarCheck2, cls: "text-sky-700 bg-sky-100" },
  question: { label: "Questions", icon: MessageCircleQuestion, cls: "text-lilac-700 bg-lilac-50" },
} as const;

export async function loadJourney(studentId: string, departmentId: string | null, base: "mentee" | "mentor"): Promise<JourneyEvent[]> {
  const [a, recs, sess, threads] = await Promise.all([
    loadAcademics(studentId, departmentId),
    recommendations({ studentId }),
    sessions({ studentId }),
    listThreads({ studentId, status: "RESOLVED" }),
  ]);
  const ev: JourneyEvent[] = [];
  for (const s of a.semesters) {
    if (s.verified_at) ev.push({ id: `sem-${s.id}`, date: s.verified_at, type: "semester", title: `Semester ${s.semester_no} verified`, detail: s.sgpa != null ? `SGPA ${fmt(s.sgpa)}` : undefined, href: base === "mentee" ? `/mentee/academics/${s.semester_no}` : undefined });
  }
  for (const r of recs.filter((r) => r.visibility === "SHARED" || base === "mentor")) {
    const type = r.kind === "GOAL" ? "goal" : r.kind === "ACTION_POINT" ? "action" : "feedback";
    ev.push({ id: `rec-${r.id}`, date: r.created_at, type, title: r.title, detail: r.kind === "GOAL" ? "Goal set" : r.kind === "ACTION_POINT" ? "Action agreed" : "Mentor shared feedback" });
    if (r.status === "COMPLETED" && r.completed_at) ev.push({ id: `done-${r.id}`, date: r.completed_at, type, title: `Completed: ${r.title}` });
  }
  for (const s of sess.filter((s) => s.status === "COMPLETED")) ev.push({ id: `ses-${s.id}`, date: s.scheduled_at, type: "session", title: "Mentoring session", detail: s.summary ?? undefined });
  for (const t of threads) ev.push({ id: `ask-${t.id}`, date: t.last_activity_at, type: "question", title: t.title, detail: "Question resolved", href: base === "mentee" ? `/mentee/ask/${t.id}` : `/mentor/inbox/${t.id}` });
  return ev.sort((x, y) => y.date.localeCompare(x.date));
}

/** Stepping Stones: a winding path of rounded stones. Vertical on mobile, horizontal scroll on desktop. */
export function SteppingStones({ events, active, basePath }: { events: JourneyEvent[]; active: string | null; basePath: string }) {
  const filtered = active ? events.filter((e) => e.type === active) : events;
  return (
    <div>
      <nav aria-label="Filter journey" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {[{ k: "", l: "Everything" }, ...Object.entries(TYPES).map(([k, t]) => ({ k, l: t.label }))].map((f) => (
          <a
            key={f.k}
            href={`${basePath}${basePath.includes("?") ? "&" : "?"}${f.k ? `type=${f.k}` : ""}`}
            aria-current={(active ?? "") === f.k ? "true" : undefined}
            className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-small font-semibold text-ink-700 aria-[current=true]:border-pine-600 aria-[current=true]:bg-pine-600 aria-[current=true]:text-white"
          >
            {f.l}
          </a>
        ))}
      </nav>
      {filtered.length === 0 ? (
        <Card>
          <EmptyState illustration="onboard-history" title="The journey starts here" body="Verified semesters, goals, sessions and resolved questions will appear as stepping stones." compact />
        </Card>
      ) : (
        <ol className="relative grid gap-4 pl-8 md:flex md:gap-0 md:overflow-x-auto md:pt-6 md:pb-4 md:pl-0" aria-label="Academic journey, newest first">
          <span aria-hidden className="absolute top-2 bottom-2 left-[15px] w-1 rounded-full bg-mint-100 md:hidden" />
          {filtered.map((e, i) => {
            const t = TYPES[e.type];
            const body = (
              <>
                <span className={cn("flex size-10 items-center justify-center rounded-control border border-line", t.cls)}>
                  <t.icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <p className="mt-3 label-caps">{fmtDate(e.date)}</p>
                <p className="mt-0.5 line-clamp-2 font-semibold text-ink-900">{e.title}</p>
                {e.detail && <p className="mt-0.5 line-clamp-2 text-small text-ink-500">{e.detail}</p>}
              </>
            );
            return (
              <li key={e.id} className={cn("relative md:w-60 md:shrink-0 md:px-2", i % 2 ? "md:mt-10" : "md:mb-10")}>
                <span aria-hidden className="absolute top-5 -left-[25px] size-3 rounded-full border-2 border-surface bg-pine-600 md:hidden" />
                {i < filtered.length - 1 && (
                  <svg aria-hidden className={cn("pointer-events-none absolute hidden md:block", i % 2 ? "-top-8 right-[-26px]" : "-bottom-8 right-[-26px]")} width="52" height="40" viewBox="0 0 52 40">
                    <path d={i % 2 ? "M2 38 C18 38 34 2 50 2" : "M2 2 C18 2 34 38 50 38"} stroke="#D6F6E8" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="2 8" />
                  </svg>
                )}
                {e.href ? (
                  <Link href={e.href} className="block rounded-[24px] border border-line bg-surface p-4 shadow-1 transition-[transform,box-shadow] duration-[220ms] ease-grow hover:-translate-y-px hover:shadow-2">
                    {body}
                  </Link>
                ) : (
                  <div className="rounded-[24px] border border-line bg-surface p-4 shadow-1">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
