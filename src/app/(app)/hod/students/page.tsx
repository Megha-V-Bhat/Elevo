import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { Button } from "@/components/ui/button";
import { Avatar, Card, Meter, StatusPill } from "@/components/ui/display";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { SavedViews } from "@/features/hod/saved-views";
import { requirePage } from "@/server/authz";
import { type DirectoryFilters, mentorActivity, savedViews, sectionsList, studentDirectory, allStudentIds } from "@/server/queries/hod";
import { roster } from "@/server/queries/roster";

export const metadata: Metadata = { title: "Students" };

const COLS = [
  { k: "full_name", l: "Student" },
  { k: "usn", l: "USN" },
  { k: "current_semester", l: "Sem" },
  { k: "section", l: "Section" },
  { k: "profile_completion", l: "Profile" },
];

export default async function HodStudents({ searchParams }: { searchParams: Promise<DirectoryFilters> }) {
  await requirePage("HOD");
  const f = await searchParams;
  // Risk filter needs the rule engine across everyone; other filters run in SQL.
  let restrict: string[] | undefined;
  if (f.risk === "flagged") restrict = (await roster(await allStudentIds(), false, false)).filter((e) => e.flags.length).map((e) => e.profile.user_id);
  const [dir, mentors, views, sections] = await Promise.all([studentDirectory(f, restrict), mentorActivity(), savedViews("students"), sectionsList()]);
  const current = Object.fromEntries(Object.entries(f).filter(([k, v]) => v && k !== "page")) as Record<string, string>;
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...current, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/hod/students${p.size ? `?${p}` : ""}`;
  };
  const [sortCol, sortDir] = (f.sort ?? "full_name.asc").split(".");
  const year = new Date().getFullYear();
  return (
    <>
      <PageHeader title="Students" subtitle={`${dir.total} student${dir.total === 1 ? "" : "s"} match. Search, filter and save views you use often.`} />
      <SavedViews scope="students" base="/hod/students" views={views} current={current} />
      <form role="search" className="mb-5 grid gap-3 rounded-card border border-line bg-surface p-3 shadow-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(6,auto)]">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Search name or USN</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
          <Input name="q" defaultValue={f.q} placeholder="Search name or USN" className="pl-9" />
        </label>
        <Select name="sem" defaultValue={f.sem ?? ""} aria-label="Semester">
          <option value="">Any semester</option>
          {Array.from({ length: 8 }, (_, i) => (
            <option key={i} value={i + 1}>
              Sem {i + 1}
            </option>
          ))}
        </Select>
        <Select name="section" defaultValue={f.section ?? ""} aria-label="Section">
          <option value="">Any section</option>
          {sections.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select name="year" defaultValue={f.year ?? ""} aria-label="Admission year">
          <option value="">Any batch</option>
          {Array.from({ length: 6 }, (_, i) => year - i).map((y) => (
            <option key={y} value={y}>
              Batch {y}
            </option>
          ))}
        </Select>
        <Select name="mentor" defaultValue={f.mentor ?? ""} aria-label="Mentor">
          <option value="">Any mentor</option>
          <option value="unassigned">Unassigned</option>
          {mentors.map((m) => (
            <option key={m.mentor_id} value={m.mentor_id}>
              {m.full_name}
            </option>
          ))}
        </Select>
        <Select name="risk" defaultValue={f.risk ?? ""} aria-label="Risk">
          <option value="">Any status</option>
          <option value="flagged">Flagged</option>
        </Select>
        <div className="flex gap-2">
          <Select name="completion" defaultValue={f.completion ?? ""} aria-label="Profile completion">
            <option value="">Any profile</option>
            <option value="incomplete">Incomplete</option>
          </Select>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </div>
      </form>
      {dir.rows.length === 0 ? (
        <Card>
          <EmptyState illustration="search" title="No students match" body="Try fewer filters, or import students in bulk." action={<Link href="/hod/imports" className="font-semibold text-pine-600 hover:underline">Import students</Link>} />
        </Card>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-card border border-line bg-surface shadow-1 md:block">
            <table className="w-full text-small">
              <caption className="sr-only">Students</caption>
              <thead className="sticky top-16 bg-canvas-sunk text-left text-ink-700">
                <tr>
                  {COLS.map((c) => {
                    const on = sortCol === c.k;
                    return (
                      <th key={c.k} scope="col" aria-sort={on ? (sortDir === "desc" ? "descending" : "ascending") : undefined} className="px-4 py-3 font-semibold">
                        <Link href={link({ sort: `${c.k}.${on && sortDir !== "desc" ? "desc" : "asc"}`, page: undefined })} className="inline-flex items-center gap-1 hover:text-pine-700">
                          {c.l}
                          {on && (sortDir === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />)}
                        </Link>
                      </th>
                    );
                  })}
                  <th scope="col" className="px-4 py-3 font-semibold">Mentor</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {dir.rows.map((r) => (
                  <tr key={r.user_id} className="border-t border-line hover:bg-canvas/60">
                    <td className="px-4 py-3">
                      <Link href={`/hod/students/${r.user_id}`} className="flex items-center gap-2 font-semibold text-ink-900 hover:underline">
                        <Avatar name={r.full_name || "Student"} size={28} /> {r.full_name || "New student"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tnum text-ink-700">{r.usn ?? "—"}</td>
                    <td className="px-4 py-3 tnum">{r.current_semester ?? "—"}</td>
                    <td className="px-4 py-3">{r.section ?? "—"}</td>
                    <td className="w-36 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Meter value={r.profile_completion} label="Profile completion" tone={r.profile_completion < 80 ? "butter" : "pine"} />
                        <span className="w-9 text-right text-ink-700 tnum">{r.profile_completion}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{r.mentor_name ?? <span className="font-semibold text-butter-800">Unassigned</span>}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-3 md:hidden">
            {dir.rows.map((r) => (
              <li key={r.user_id}>
                <Link href={`/hod/students/${r.user_id}`} className="block rounded-card border border-line bg-surface p-4 shadow-1">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.full_name || "Student"} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink-900">{r.full_name || "New student"}</p>
                      <p className="text-small text-ink-500">{[r.usn, r.current_semester && `Sem ${r.current_semester}`, r.section].filter(Boolean).join(" · ")}</p>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="mt-2 text-small text-ink-700">Mentor: {r.mentor_name ?? <span className="font-semibold text-butter-800">Unassigned</span>}</p>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label="Pagination" className="mt-5 flex items-center justify-between gap-3">
            <p className="text-small text-ink-500 tnum">
              Page {dir.page} of {dir.pages}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="secondary" size="sm" className={dir.page <= 1 ? "pointer-events-none opacity-50" : ""}>
                <Link href={link({ page: String(dir.page - 1) })} aria-disabled={dir.page <= 1}>
                  <ChevronLeft /> Previous
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm" className={dir.page >= dir.pages ? "pointer-events-none opacity-50" : ""}>
                <Link href={link({ page: String(dir.page + 1) })} aria-disabled={dir.page >= dir.pages}>
                  Next <ChevronRight />
                </Link>
              </Button>
            </div>
          </nav>
        </>
      )}
    </>
  );
}
