import { MessageCircleQuestion, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { Button } from "@/components/ui/button";
import { Card, Chip, StatusPill } from "@/components/ui/display";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { fmtDate } from "@/lib/dates";
import { requirePage } from "@/server/authz";
import { listThreads } from "@/server/queries/ask";
import { mentorOf } from "@/server/queries/people";

export const metadata: Metadata = { title: "Ask my mentor" };

export default async function AskList() {
  const me = await requirePage("MENTEE");
  const [threads, mentor] = await Promise.all([listThreads({ studentId: me.id }), mentorOf(me.id)]);
  const cta = mentor ? (
    <Button asChild>
      <Link href="/mentee/ask/new">
        <Plus /> Ask a question
      </Link>
    </Button>
  ) : undefined;
  return (
    <>
      <PageHeader
        title="Ask my mentor"
        subtitle={mentor ? `Private questions to ${mentor.full_name}. Replies usually arrive within two days.` : "You'll be able to ask questions once your HOD assigns you a mentor."}
        action={cta}
      />
      {threads.length === 0 ? (
        <Card>
          <EmptyState illustration="questions" title="No questions yet" body="Stuck on something? Ask your mentor. Only the two of you can see it." action={cta} />
        </Card>
      ) : (
        <ul className="grid gap-3">
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={`/mentee/ask/${t.id}`} className="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-1 transition-[transform,box-shadow,border-color] duration-[220ms] ease-grow hover:-translate-y-px hover:border-pine-100 hover:shadow-2">
                <span className="hidden size-10 shrink-0 items-center justify-center rounded-control bg-lilac-50 text-lilac-700 sm:flex">
                  <MessageCircleQuestion className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-900">{t.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-small text-ink-500">
                    {t.subject && <Chip>{t.subject.code}</Chip>}
                    Last activity {fmtDate(t.last_activity_at, { day: "numeric", month: "short" })}
                  </p>
                </div>
                <StatusPill status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
