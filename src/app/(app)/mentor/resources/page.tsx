import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/display";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { DeleteResourceButton } from "@/features/mentor/delete-resource";
import { ResourceUploader } from "@/features/mentor/composers";
import { ResourceCard } from "@/features/mentoring/resource-card";
import { requirePage } from "@/server/authz";
import { subjectCatalog } from "@/server/queries/academics";
import { resources } from "@/server/queries/mentoring";
import { menteeProfiles } from "@/server/queries/people";

export const metadata: Metadata = { title: "Resources" };

export default async function MentorResources() {
  const me = await requirePage("MENTOR");
  const [list, mentees, catalog] = await Promise.all([resources({ mentorId: me.id }), menteeProfiles(me.id), subjectCatalog(me.department_id)]);
  const names = new Map(mentees.map((m) => [m.user_id, m.full_name]));
  return (
    <>
      <PageHeader
        title="Resources"
        subtitle="Notes, slides and links you've shared. Students see them in their library with your instructions."
        action={
          <Suspense>
            <ResourceUploader students={mentees.map((m) => ({ id: m.user_id, label: m.full_name }))} subjects={catalog.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }))} autoOpenParam="new" />
          </Suspense>
        }
      />
      {list.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <ResourceCard key={r.id} r={r} target={r.student_id ? (names.get(r.student_id) ?? "Former mentee") : "All my mentees"} footer={<DeleteResourceButton id={r.id} />} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState illustration="resources" title="No resources yet" body="Upload notes, slides or links. Share with one mentee or all of them." />
        </Card>
      )}
    </>
  );
}
