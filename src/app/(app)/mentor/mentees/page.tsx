import { Search } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/display";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { MenteeCard } from "@/features/mentor/mentee-card";
import { requirePage } from "@/server/authz";
import { menteeIds } from "@/server/queries/people";
import { roster } from "@/server/queries/roster";

export const metadata: Metadata = { title: "Mentees" };

export default async function MentorMentees({ searchParams }: { searchParams: Promise<{ q?: string; sem?: string; section?: string; flagged?: string }> }) {
  const me = await requirePage("MENTOR");
  const sp = await searchParams;
  const entries = await roster(await menteeIds(me.id), true);
  const q = (sp.q ?? "").toLowerCase().trim();
  const list = entries.filter(
    (e) =>
      (!q || e.profile.full_name.toLowerCase().includes(q) || (e.profile.usn ?? "").toLowerCase().includes(q)) &&
      (!sp.sem || String(e.profile.current_semester) === sp.sem) &&
      (!sp.section || e.profile.section === sp.section) &&
      (!sp.flagged || e.flags.length + e.pulse.length > 0),
  );
  const sems = [...new Set(entries.map((e) => e.profile.current_semester).filter(Boolean))].sort();
  const sections = [...new Set(entries.map((e) => e.profile.section).filter(Boolean))].sort();
  return (
    <>
      <PageHeader title="Mentees" subtitle={`${entries.length} students assigned to you. Only your current mentees are listed.`} />
      <form className="mb-5 grid gap-3 rounded-card border border-line bg-surface p-3 shadow-1 sm:grid-cols-[1fr_auto_auto_auto_auto]" role="search">
        <label className="relative">
          <span className="sr-only">Search by name or USN</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Search name or USN" className="pl-9" />
        </label>
        <Select name="sem" defaultValue={sp.sem ?? ""} aria-label="Semester">
          <option value="">All semesters</option>
          {sems.map((s) => (
            <option key={s} value={String(s)}>
              Sem {s}
            </option>
          ))}
        </Select>
        <Select name="section" defaultValue={sp.section ?? ""} aria-label="Section">
          <option value="">All sections</option>
          {sections.map((s) => (
            <option key={s} value={s!}>
              Section {s}
            </option>
          ))}
        </Select>
        <Select name="flagged" defaultValue={sp.flagged ?? ""} aria-label="Attention">
          <option value="">Everyone</option>
          <option value="1">Needs attention</option>
        </Select>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>
      {list.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => (
            <MenteeCard key={e.profile.user_id} e={e} href={`/mentor/mentees/${e.profile.user_id}`} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState illustration={entries.length ? "search" : "mentees"} title={entries.length ? "No matches" : "No mentees yet"} body={entries.length ? "Try a different name, USN or filter." : "Your HOD assigns mentees."} />
        </Card>
      )}
    </>
  );
}
