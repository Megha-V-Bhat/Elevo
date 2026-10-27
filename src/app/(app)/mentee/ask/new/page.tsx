import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/display";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { NewThreadForm } from "@/features/ask/composer";
import { requirePage } from "@/server/authz";
import { subjectCatalog } from "@/server/queries/academics";
import { mentorOf, studentProfile } from "@/server/queries/people";

export const metadata: Metadata = { title: "Ask a question" };

export default async function NewQuestion() {
  const me = await requirePage("MENTEE");
  const [mentor, profile] = await Promise.all([mentorOf(me.id), studentProfile(me.id)]);
  const subjects = await subjectCatalog(me.department_id, profile?.current_semester ?? undefined);
  return (
    <>
      <Link href="/mentee/ask" className="mb-3 inline-flex min-h-9 items-center gap-1 text-small font-semibold text-pine-600 hover:underline">
        <ArrowLeft className="size-4" /> All questions
      </Link>
      <PageHeader title="Ask a question" subtitle={mentor ? `Goes privately to ${mentor.full_name}. Your draft is kept if you leave this page.` : undefined} />
      <Card className="max-w-3xl">
        {mentor ? (
          <NewThreadForm subjects={subjects.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }))} />
        ) : (
          <EmptyState illustration="mentees" title="No mentor yet" body="Your HOD hasn't assigned a mentor yet. You'll get a notification when they do." />
        )}
      </Card>
    </>
  );
}
