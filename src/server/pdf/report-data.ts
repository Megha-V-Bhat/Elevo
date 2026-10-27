import "server-only";
import { cgpa as cgpaOf } from "@/lib/engine/grading";
import { fmtDate } from "@/lib/dates";
import { loadAcademics } from "../queries/academics";
import { CATEGORY_LABEL, KIND_LABEL, recommendations } from "../queries/mentoring";
import { mentorOf, studentProfile } from "../queries/people";
import { appSettings } from "../queries/settings";
import { signedUrl } from "../files";
import { db } from "../supabase";
import type { ReportData } from "./student-report";

const n = (v: number | null | undefined) => (v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(1));

/** Builds report data strictly from VERIFIED/FINALIZED semesters and shared, report-flagged items. */
export async function buildReportData(studentId: string): Promise<ReportData | null> {
  const p = await studentProfile(studentId);
  if (!p) return null;
  const supabase = await db();
  const [a, mentor, recs, settings, { data: dept }] = await Promise.all([
    loadAcademics(studentId, p.department_id),
    mentorOf(studentId),
    recommendations({ studentId, limit: 200 }),
    appSettings(),
    supabase.from("departments").select("name, institution").eq("id", p.department_id).maybeSingle(),
  ]);
  const verified = a.semesters.filter((s) => (s.status === "VERIFIED" || s.status === "FINALIZED") && !s.manual);
  const cg = cgpaOf(verified.flatMap((s) => s.results.map((r) => ({ subject_key: r.subject.code, semester_no: s.semester_no, credits: r.subject.credits, points: r.grade_points ?? r.derived_points }))));
  return {
    institution: dept?.institution ?? settings.institution,
    department: dept?.name ?? "Department",
    generatedAt: fmtDate(new Date().toISOString()),
    student: {
      name: p.full_name || "Student",
      usn: p.usn,
      program: p.program,
      semester: p.current_semester,
      section: p.section,
      academicYear: verified.at(-1)?.academic_year ?? null,
      email: p.email ?? null,
      photo: await signedUrl("avatars", p.avatar_path),
    },
    mentor: mentor?.full_name ?? null,
    cgpa: cg.value?.cgpa ?? null,
    creditsCompleted: verified.reduce((x, s) => x + s.credits_earned, 0),
    semesters: verified.map((s) => ({
      no: s.semester_no,
      year: s.academic_year,
      status: s.status as "VERIFIED" | "FINALIZED",
      sgpa: s.sgpa,
      credits: s.credits,
      subjects: s.results.map((r) => ({
        code: r.subject.code,
        name: r.subject.name,
        mse: r.subject.has_mse ? n(r.mse_marks) : "n/a",
        see: r.subject.has_see ? n(r.see_marks) : "n/a",
        max: `${r.subject.has_mse ? n(r.mse_max) : "–"}/${r.subject.has_see ? n(r.see_max) : "–"}`,
        credits: n(r.subject.credits),
        grade: r.grade ?? r.derived_grade ?? "—",
        result: r.result === "PASS" ? "Pass" : r.result === "FAIL" ? "Fail" : r.result === "ABSENT" ? "Absent" : "Pending",
      })),
    })),
    mentoring: recs
      .filter((r) => r.visibility === "SHARED" && r.include_in_report)
      .map((r) => ({
        kind: KIND_LABEL[r.kind],
        category: CATEGORY_LABEL[r.category],
        title: r.title,
        body: r.body,
        status: r.status === "IN_PROGRESS" ? "In progress" : r.status === "COMPLETED" ? "Completed" : "Pending",
        date: fmtDate(r.created_at),
        due: r.due_date ? fmtDate(r.due_date) : null,
      })),
  };
}
