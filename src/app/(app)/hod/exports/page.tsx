import { FileDown, FileSpreadsheet, FileText, Lock } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/display";
import { Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { requirePage } from "@/server/authz";
import { sectionsList } from "@/server/queries/hod";

export const metadata: Metadata = { title: "Exports" };

const ITEMS = [
  { k: "department-summary", t: "Department summary", d: "Students, average CGPA/SGPA, flagged and incomplete profiles per section." },
  { k: "academic-summary", t: "Academic summary", d: "One row per student: CGPA, latest SGPA, credits, verified semesters, failed subjects." },
  { k: "mentor-workload", t: "Mentor workload", d: "Mentees vs capacity, feedback and sessions, response time and Pulse participation (aggregates)." },
  { k: "assignments", t: "Assignment list", d: "Every student with their current mentor and since when." },
  { k: "interventions", t: "Intervention list", d: "Flagged students with the reasons behind each flag." },
];

export default async function Exports({ searchParams }: { searchParams: Promise<{ sem?: string; section?: string }> }) {
  await requirePage("HOD");
  const sp = await searchParams;
  const sections = await sectionsList();
  const qs = (format: string) => new URLSearchParams({ format, ...(sp.sem ? { sem: sp.sem } : {}), ...(sp.section ? { section: sp.section } : {}) }).toString();
  return (
    <>
      <PageHeader title="Exports" subtitle="Controlled, audited downloads for administration. Filters apply to student-level exports." />
      <form className="mb-5 flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-3 shadow-1">
        <Select name="sem" defaultValue={sp.sem ?? ""} aria-label="Semester" className="w-44">
          <option value="">All semesters</option>
          {Array.from({ length: 8 }, (_, i) => (
            <option key={i} value={i + 1}>
              Semester {i + 1}
            </option>
          ))}
        </Select>
        <Select name="section" defaultValue={sp.section ?? ""} aria-label="Section" className="w-44">
          <option value="">All sections</option>
          {sections.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
      </form>
      <div className="grid gap-4 md:grid-cols-2">
        {ITEMS.map((i) => (
          <Card key={i.k}>
            <h2 className="flex items-center gap-2 font-display text-h3 font-semibold text-ink-900">
              <FileDown className="size-5 text-pine-600" aria-hidden /> {i.t}
            </h2>
            <p className="mt-1 text-small text-ink-500">{i.d}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`/api/exports/${i.k}?${qs("xlsx")}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-control bg-pine-600 px-3 text-small font-semibold text-white hover:bg-pine-700">
                <FileSpreadsheet className="size-4" /> Excel
              </a>
              <a href={`/api/exports/${i.k}?${qs("csv")}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-line px-3 text-small font-semibold text-ink-900 hover:bg-pine-50">
                CSV
              </a>
              <a href={`/api/exports/${i.k}?${qs("pdf")}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-line px-3 text-small font-semibold text-ink-900 hover:bg-pine-50">
                <FileText className="size-4" /> Summary PDF
              </a>
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-6 flex items-center gap-2 text-small text-ink-500">
        <Lock className="size-4" aria-hidden /> Pulse check-ins, questions and planner results are never exportable. Every download is recorded in the audit history.
      </p>
    </>
  );
}
