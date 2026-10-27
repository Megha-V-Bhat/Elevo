import type { Metadata } from "next";
import { Card, StatusPill } from "@/components/ui/display";
import { PageHeader, Section } from "@/components/ui/layout";
import { ImportWizard } from "@/features/hod/import-wizard";
import { fmtDateTime } from "@/lib/dates";
import { requirePage } from "@/server/authz";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Imports" };

export default async function Imports() {
  await requirePage("HOD");
  const supabase = await db();
  const { data: jobs } = await supabase.from("import_jobs").select("id, kind, file_name, status, total_rows, valid_rows, error_rows, created_at, committed_at").order("created_at", { ascending: false }).limit(10);
  return (
    <>
      <PageHeader title="Bulk import" subtitle="Add students, mentors, subjects or results from a spreadsheet. You'll see every row checked before anything is saved." />
      <ImportWizard />
      {jobs?.length ? (
        <Section title="Recent imports">
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {jobs.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-small">
                  <span className="font-semibold text-ink-900 capitalize">{j.kind}</span>
                  <span className="text-ink-500">{j.file_name}</span>
                  <span className="text-ink-700 tnum">
                    {j.valid_rows}/{j.total_rows} valid
                  </span>
                  <span className="ml-auto text-ink-500">{fmtDateTime(j.committed_at ?? j.created_at)}</span>
                  <StatusPill status={j.status === "COMMITTED" ? "COMPLETED" : j.status === "PREVIEW" ? "DRAFT" : "REJECTED"} />
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}
    </>
  );
}
