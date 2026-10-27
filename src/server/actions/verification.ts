"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cgpa, gradeSubject, sgpa } from "@/lib/engine/grading";
import { requireRole } from "../authz";
import { type Academics, loadAcademics } from "../queries/academics";
import { AppError, handle, must } from "../result";
import { db } from "../supabase";

const uuid = z.string().uuid();

/** SGPA + CGPA snapshot for a semester, computed by the grading engine. */
function summaryFor(a: Academics, semId: string, override?: { resultId: string; patch: Record<string, unknown> }) {
  const sems = a.semesters.map((s) => ({
    ...s,
    results: s.results.map((r) => {
      if (!override || r.id !== override.resultId) return r;
      const merged = { ...r, ...override.patch } as typeof r;
      const g = gradeSubject({ has_mse: r.subject.has_mse, has_see: r.subject.has_see, mse_marks: merged.mse_marks, mse_max: merged.mse_max, see_marks: merged.see_marks, see_max: merged.see_max, ia: merged.ia }, a.scheme).value;
      return { ...merged, derived_points: g?.points ?? null, grade_points: "grade_points" in override.patch ? (override.patch.grade_points as number | null) : (g?.points ?? merged.grade_points) };
    }),
  }));
  const sem = sems.find((s) => s.id === semId);
  if (!sem) return null;
  const s = sgpa(sem.results.map((r) => ({ credits: r.subject.credits, points: r.grade_points ?? r.derived_points })));
  const upTo = sems.filter((x) => x.semester_no <= sem.semester_no && x.results.length);
  const c = cgpa(upTo.flatMap((x) => x.results.map((r) => ({ subject_key: r.subject.code, semester_no: x.semester_no, credits: r.subject.credits, points: r.grade_points ?? r.derived_points }))));
  const credits = sem.results.every((r) => r.subject.credits != null) ? sem.results.reduce((x, r) => x + (r.subject.credits ?? 0), 0) : null;
  return {
    sgpa: s.value,
    cgpa_snapshot: c.value?.cgpa ?? null,
    credits_registered: credits,
    credits_earned: sem.results.filter((r) => (r.grade_points ?? r.derived_points ?? 0) > 0).reduce((x, r) => x + (r.subject.credits ?? 0), 0),
    computed: s.value != null,
    computation_note: s.reason ? `SGPA not calculated: ${s.reason}` : null,
  };
}

export async function verifySemesters(semesterIds: string[]) {
  return handle(async () => {
    await requireRole("MENTOR", "HOD");
    const ids = z.array(uuid).min(1).max(100).parse(semesterIds);
    const supabase = await db();
    const { data: sems } = await supabase.from("academic_semesters").select("id, student_id, status").in("id", ids);
    const summaries: Record<string, unknown> = {};
    for (const studentId of new Set((sems ?? []).map((s) => s.student_id))) {
      const { data: u } = await supabase.from("users").select("department_id").eq("id", studentId).maybeSingle();
      const a = await loadAcademics(studentId, u?.department_id ?? null);
      for (const s of (sems ?? []).filter((x) => x.student_id === studentId)) {
        const sum = summaryFor(a, s.id);
        if (sum) summaries[s.id] = sum;
      }
    }
    const { data: n, error } = await supabase.rpc("verify_semesters", { p_ids: ids, p_summaries: summaries });
    if (error) throw new AppError(error.code === "42501" ? "FORBIDDEN" : "INTERNAL", error.message);
    revalidatePath("/mentor", "layout");
    revalidatePath("/hod", "layout");
    return n as number;
  });
}

export async function returnSemester(semesterId: string, note: string) {
  return handle(async () => {
    await requireRole("MENTOR", "HOD");
    const text = z.string().trim().min(3, "Tell the student what to fix").max(1000).parse(note);
    const supabase = await db();
    must(await supabase.rpc("return_semester", { p_id: uuid.parse(semesterId), p_note: text }));
    revalidatePath("/mentor", "layout");
    return true;
  });
}

export async function finalizeSemester(semesterId: string) {
  return handle(async () => {
    await requireRole("HOD");
    const supabase = await db();
    must(await supabase.rpc("finalize_semester", { p_id: uuid.parse(semesterId) }));
    revalidatePath("/hod", "layout");
    return true;
  });
}

export async function decideChangeRequest(requestId: string, approve: boolean, note?: string) {
  return handle(async () => {
    await requireRole("MENTOR", "HOD");
    const supabase = await db();
    const { data: r } = await supabase.from("record_change_requests").select("id, student_id, target_id, proposed").eq("id", uuid.parse(requestId)).maybeSingle();
    if (!r) throw new AppError("NOT_FOUND", "We couldn't find that request.");
    let summary: Record<string, unknown> | null = null;
    if (approve) {
      const { data: u } = await supabase.from("users").select("department_id").eq("id", r.student_id).maybeSingle();
      const a = await loadAcademics(r.student_id, u?.department_id ?? null);
      const sem = a.semesters.find((s) => s.results.some((x) => x.id === r.target_id));
      if (sem) summary = summaryFor(a, sem.id, { resultId: r.target_id, patch: r.proposed as Record<string, unknown> });
    }
    must(await supabase.rpc("decide_change_request", { p_id: r.id, p_approve: approve, p_note: note ? z.string().max(1000).parse(note) : null, p_summary: summary }));
    revalidatePath("/mentor", "layout");
    revalidatePath("/hod", "layout");
    return true;
  });
}
