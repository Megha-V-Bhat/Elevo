import { Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, Card, Chip, StatusPill } from "@/components/ui/display";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { requirePage } from "@/server/authz";
import { listThreads } from "@/server/queries/ask";

export const metadata: Metadata = { title: "Inbox" };

const FILTERS = [
  { k: "", l: "All" },
  { k: "open", l: "Open" },
  { k: "unanswered", l: "Unanswered > 48 h" },
  { k: "answered", l: "Answered" },
  { k: "resolved", l: "Resolved" },
];

export default async function MentorInbox({ searchParams }: { searchParams: Promise<{ filter?: string; subject?: string; mentee?: string }> }) {
  await requirePage("MENTOR");
  const sp = await searchParams;
  const all = await listThreads({ limit: 200 });
  const now = Date.now();
  const list = all
    .filter((t) =>
      sp.filter === "open" ? t.status === "OPEN" : sp.filter === "unanswered" ? t.status === "OPEN" && !t.first_response_at && now - Date.parse(t.created_at) > 48 * 3600_000 : sp.filter === "answered" ? t.status === "ANSWERED" : sp.filter === "resolved" ? t.status === "RESOLVED" : true,
    )
    .filter((t) => !sp.subject || t.subject?.id === sp.subject)
    .filter((t) => !sp.mentee || t.student_id === sp.mentee);
  const subjects = [...new Map(all.filter((t) => t.subject).map((t) => [t.subject!.id, t.subject!])).values()];
  const mentees = [...new Map(all.map((t) => [t.student_id, t.student_name ?? "Student"])).entries()];
  const q = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ filter: sp.filter ?? "", subject: sp.subject ?? "", mentee: sp.mentee ?? "", ...patch }).filter(([, v]) => v));
    return `/mentor/inbox${p.size ? `?${p}` : ""}`;
  };
  return (
    <>
      <PageHeader title="Inbox" subtitle="Questions from your current mentees. Threads move with a student if they're reassigned." />
      <nav aria-label="Filter questions" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {FILTERS.map((f) => (
          <Link key={f.k} href={q({ filter: f.k })} aria-current={(sp.filter ?? "") === f.k ? "true" : undefined} className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-small font-semibold text-ink-700 aria-[current=true]:border-pine-600 aria-[current=true]:bg-pine-600 aria-[current=true]:text-white">
            {f.l}
          </Link>
        ))}
      </nav>
      {(subjects.length > 0 || mentees.length > 1) && (
        <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {subjects.map((s) => (
            <Link key={s.id} href={q({ subject: sp.subject === s.id ? "" : s.id })} aria-current={sp.subject === s.id ? "true" : undefined} className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-canvas-sunk px-3 text-small font-semibold text-ink-700 aria-[current=true]:bg-lilac-100 aria-[current=true]:text-lilac-700">
              {s.code}
            </Link>
          ))}
          {mentees.map(([id, name]) => (
            <Link key={id} href={q({ mentee: sp.mentee === id ? "" : id })} aria-current={sp.mentee === id ? "true" : undefined} className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-canvas-sunk px-3 text-small font-semibold text-ink-700 aria-[current=true]:bg-mint-100 aria-[current=true]:text-pine-700">
              {name}
            </Link>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <Card>
          <EmptyState illustration="questions" title={all.length ? "Nothing matches" : "No questions yet"} body={all.length ? "Try another filter." : "When a mentee asks a question it lands here, and you'll be reminded if it waits more than 48 hours."} />
        </Card>
      ) : (
        <ul className="grid gap-2">
          {list.map((t) => {
            const late = t.status === "OPEN" && !t.first_response_at && now - Date.parse(t.created_at) > 48 * 3600_000;
            return (
              <li key={t.id}>
                <Link href={`/mentor/inbox/${t.id}`} className={cn("flex items-center gap-3 rounded-card border bg-surface p-4 shadow-1 transition-colors hover:border-pine-100", late ? "border-butter-300" : "border-line")}>
                  <Avatar name={t.student_name ?? "Student"} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink-900">
                      {!t.mentor_seen_at && <span className="mr-1.5 inline-block size-2 rounded-full bg-pine-600 align-middle" aria-label="Unread" />}
                      {t.title}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-small text-ink-500">
                      {t.student_name} · {fmtDate(t.last_activity_at, { day: "numeric", month: "short" })}
                      {t.subject && <Chip>{t.subject.code}</Chip>}
                      {late && (
                        <Chip tone="butter">
                          <Clock className="size-3" aria-hidden /> Waiting over 48 h
                        </Chip>
                      )}
                    </p>
                  </div>
                  <StatusPill status={t.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
