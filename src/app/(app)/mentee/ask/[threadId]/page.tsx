import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/layout";
import { ReplyBox, ResolveButton } from "@/features/ask/composer";
import { ThreadView } from "@/features/ask/thread-view";
import { requirePage } from "@/server/authz";
import { getThread } from "@/server/queries/ask";

export const metadata: Metadata = { title: "Question" };

export default async function MenteeThread({ params }: { params: Promise<{ threadId: string }> }) {
  const me = await requirePage("MENTEE");
  const data = await getThread((await params).threadId);
  if (!data || data.thread.student_id !== me.id) notFound();
  return (
    <>
      <Link href="/mentee/ask" className="mb-3 inline-flex min-h-9 items-center gap-1 text-small font-semibold text-pine-600 hover:underline">
        <ArrowLeft className="size-4" /> All questions
      </Link>
      <PageHeader title={data.thread.title} action={<ResolveButton threadId={data.thread.id} status={data.thread.status} />} />
      <div className="mx-auto grid max-w-3xl gap-6">
        <ThreadView data={data} meId={me.id} viewer="MENTEE" />
        <ReplyBox threadId={data.thread.id} />
        {data.thread.status === "ANSWERED" && <p className="text-center text-small text-ink-500">Answered threads resolve automatically after 7 days. Reply any time to reopen.</p>}
      </div>
    </>
  );
}
