import "server-only";
import { fmtDate } from "@/lib/dates";
import type { Role } from "./authz";
import { activeAssignments, allStudentIds, mentorActivity } from "./queries/hod";
import { menteeIds } from "./queries/people";
import { roster } from "./queries/roster";

export type ExportKind = "department-summary" | "mentor-workload" | "assignments" | "interventions" | "academic-summary" | "mentees";
export type Table = { title: string; columns: string[]; rows: (string | number | null)[][] };

export const EXPORTS: Record<ExportKind, { title: string; roles: Role[] }> = {
  "department-summary": { title: "Department summary", roles: ["HOD"] },
  "mentor-workload": { title: "Mentor workload", roles: ["HOD"] },
  assignments: { title: "Assignment list", roles: ["HOD"] },
  interventions: { title: "Intervention list", roles: ["HOD"] },
  "academic-summary": { title: "Academic summary", roles: ["HOD"] },
  mentees: { title: "My mentees", roles: ["MENTOR"] },
};

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
};

/**
 * Builds export tables. By design no export reads Pulse check-ins, Ask threads or
 * planner results — they are website-only.
 */
export async function buildExport(kind: ExportKind, me: { id: string }, f: { sem?: string; section?: string }): Promise<Table> {
  const filter = <T extends { profile: { current_semester: number | null; section: string | null } }>(xs: T[]) =>
    xs.filter((e) => (!f.sem || String(e.profile.current_semester) === f.sem) && (!f.section || e.profile.section === f.section));

  if (kind === "mentees") {
    const entries = await roster(await menteeIds(me.id), false, false);
    return {
      title: EXPORTS[kind].title,
      columns: ["Name", "USN", "Semester", "Section", "CGPA", "Latest SGPA", "Verified semesters", "Profile %"],
      rows: entries.map((e) => [e.profile.full_name, e.profile.usn, e.profile.current_semester, e.profile.section, e.academics.cgpa, e.latestSgpa, e.academics.verified_count, e.profile.profile_completion]),
    };
  }
  if (kind === "mentor-workload") {
    const m = await mentorActivity();
    return {
      title: EXPORTS[kind].title,
      columns: ["Mentor", "Designation", "Mentees", "Capacity", "Feedback (30 d)", "Sessions (30 d)", "Median first reply (h)", "Pulse participation %", "Open questions"],
      rows: m.map((x) => [x.full_name, x.designation, x.mentees, x.capacity, x.feedback_30d, x.sessions_30d, x.median_first_response_hours, x.pulse_participation_pct, x.open_threads]),
    };
  }
  const entries = filter(await roster(await allStudentIds(), false, false));
  if (kind === "assignments") {
    const [asg, m] = await Promise.all([activeAssignments(), mentorActivity()]);
    const mOf = new Map(asg.map((a) => [a.student_id, a]));
    const mName = new Map(m.map((x) => [x.mentor_id, x.full_name]));
    return {
      title: EXPORTS[kind].title,
      columns: ["Student", "USN", "Semester", "Section", "Mentor", "Assigned since"],
      rows: entries.map((e) => {
        const a = mOf.get(e.profile.user_id);
        return [e.profile.full_name, e.profile.usn, e.profile.current_semester, e.profile.section, a ? (mName.get(a.mentor_id) ?? "") : "Unassigned", a ? fmtDate(a.started_at) : null];
      }),
    };
  }
  if (kind === "interventions") {
    return {
      title: EXPORTS[kind].title,
      columns: ["Student", "USN", "Semester", "Section", "Flags", "Reasons"],
      rows: entries.filter((e) => e.flags.length).map((e) => [e.profile.full_name, e.profile.usn, e.profile.current_semester, e.profile.section, e.flags.map((x) => x.label).join("; "), e.flags.map((x) => x.reason).join(" | ")]),
    };
  }
  if (kind === "academic-summary") {
    return {
      title: EXPORTS[kind].title,
      columns: ["Student", "USN", "Semester", "Section", "CGPA", "Latest SGPA", "Credits counted", "Verified semesters", "Failed subjects"],
      rows: entries.map((e) => [
        e.profile.full_name,
        e.profile.usn,
        e.profile.current_semester,
        e.profile.section,
        e.academics.cgpa,
        e.latestSgpa,
        e.academics.earned_credits,
        e.academics.verified_count,
        e.academics.semesters.flatMap((s) => s.results.filter((r) => r.result === "FAIL").map((r) => r.subject.code)).join(", "),
      ]),
    };
  }
  // department-summary: one row per section + a total row
  const sections = [...new Set(entries.map((e) => e.profile.section ?? "—"))].sort();
  const row = (label: string, xs: typeof entries) => [label, xs.length, avg(xs.map((e) => e.academics.cgpa)), avg(xs.map((e) => e.latestSgpa)), xs.filter((e) => e.flags.length).length, xs.filter((e) => e.profile.profile_completion < 80).length];
  return {
    title: EXPORTS[kind].title,
    columns: ["Section", "Students", "Average CGPA", "Average latest SGPA", "Flagged", "Incomplete profiles"],
    rows: [...sections.map((s) => row(`Section ${s}`, entries.filter((e) => (e.profile.section ?? "—") === s))), row("All", entries)],
  };
}
