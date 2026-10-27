import { ArrowLeft, Link2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/display";
import { PageHeader } from "@/components/ui/layout";
import { ReplyBox, ResolveButton } from "@/features/ask/composer";
import { ThreadSeen } from "@/features/ask/mark-seen";
import { ThreadView } from "@/features/ask/thread-view";
import { RecComposer, SessionScheduler } from "@/features/mentor/composers";
import { isActiveMentorOf, requirePage } from "@/server/authz";
import { subjectCatalog } from "@/server/queries/academics";
import { getThread } from "@/server/queries/ask";
import { resources } from "@/server/queries/mentoring";

export const metadata: Metadata = { title: "Question" };

export default async function MentorThread({ params }: { params: Promise<{ threadId: string }> }) {
  const me = await requirePage("MENTOR");
  const data = await getThread((await params).threadId);
  if (!data || !(await isActiveMentorOf(me.id, data.thread.student_id))) notFound();
  const t = data.thread;
  const [mine, catalog] = await Promise.all([resources({ mentorId: me.id }), subjectCatalog(me.department_id)]);
  const firstMsg = data.messages[0]?.body ?? "";
  return (
    <>
      <ThreadSeen id={t.id} seen={!!t.mentor_seen_at} />
      <Link href="/mentor/inbox" className="mb-3 inline-flex min-h-9 items-center gap-1 text-small font-semibold text-pine-600 hover:underline">
        <ArrowLeft className="size-4" /> Inbox
      </Link>
      <PageHeader
        title={t.title}
        subtitle={
          <>
            From{" "}
            <Link href={`/mentor/mentees/${t.student_id}`} className="font-semibold text-pine-600 hover:underline">
              {data.names.get(t.student_id) ?? "your mentee"}
            </Link>
          </>
        }
        action={<ResolveButton threadId={t.id} status={t.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-6">
          <ThreadView data={data} meId={me.id} viewer="MENTOR" />
          <ReplyBox threadId={t.id} resources={mine.filter((r) => r.student_id == null || r.student_id === t.student_id).map((r) => ({ id: r.id, title: r.title }))} />
        </div>
        <aside className="grid content-start gap-3">
          <Card>
            <h2 className="mb-3 font-display text-h3 font-semibold text-ink-900">Turn it into action</h2>
            <div className="grid gap-2 [&_button]:w-full">
              {t.converted_recommendation_id ? (
                <p className="flex items-center gap-1.5 text-small font-semibold text-pine-700">
                  <Link2 className="size-4" /> Converted to a recommendation
                </p>
              ) : (
                <RecComposer studentId={t.student_id} subjects={catalog.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }))} prefill={{ kind: "RECOMMENDATION", title: t.title, body: firstMsg ? `Re: “${firstMsg.slice(0, 300)}”\n\n` : "", subject_id: t.subject?.id, source: "ASK_THREAD", source_id: t.id }} />
              )}
              {t.converted_session_id ? (
                <p className="flex items-center gap-1.5 text-small font-semibold text-pine-700">
                  <Link2 className="size-4" /> Session suggested
                </p>
              ) : (
                <SessionScheduler studentId={t.student_id} sourceThreadId={t.id} label="Suggest a session" />
              )}
            </div>
          </Card>
          <p className="px-1 text-small text-ink-500">Questions are private between you and the student. The HOD only sees counts and response times.</p>
        </aside>
      </div>
    </>
  );
}
