import { Download, Eye, FileText } from "lucide-react";
import type { Metadata } from "next";
import { Avatar, Card, Chip } from "@/components/ui/display";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { requirePage } from "@/server/authz";
import { menteeIds } from "@/server/queries/people";
import { roster } from "@/server/queries/roster";

export const metadata: Metadata = { title: "Reports" };

export default async function MentorReports() {
  const me = await requirePage("MENTOR");
  const entries = await roster(await menteeIds(me.id), false);
  return (
    <>
      <PageHeader
        title="Student reports"
        subtitle="Professional PDF reports built from verified records and the mentoring items you've marked for inclusion. No charts, insights, Pulse, plans or questions — ever."
        action={
          <a href="/api/exports/mentees?format=xlsx" download className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface px-4 font-semibold text-ink-900 shadow-1 hover:bg-pine-50">
            <Download className="size-[18px]" /> Export my mentee list
          </a>
        }
      />
      {entries.length ? (
        <ul className="grid gap-3">
          {entries.map((e) => (
            <li key={e.profile.user_id}>
              <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={e.profile.full_name} src={e.profile.avatar_url} size={40} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-900">{e.profile.full_name}</p>
                    <p className="text-small text-ink-500">{e.profile.usn}</p>
                  </div>
                </div>
                <Chip tone={e.academics.verified_count ? "mint" : "butter"}>
                  {e.academics.verified_count}/{e.academics.semesters.length} semesters verified
                </Chip>
                <div className="flex gap-2">
                  <a href={`/api/reports/student/${e.profile.user_id}`} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-line px-3 text-small font-semibold text-ink-900 hover:bg-pine-50">
                    <Eye className="size-4" /> Preview
                  </a>
                  <a href={`/api/reports/student/${e.profile.user_id}?download=1`} className="inline-flex min-h-10 items-center gap-1.5 rounded-control bg-pine-600 px-3 text-small font-semibold text-white hover:bg-pine-700">
                    <FileText className="size-4" /> Download PDF
                  </a>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState illustration="mentees" title="No mentees yet" body="Reports become available once mentees are assigned to you." />
        </Card>
      )}
    </>
  );
}
