"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { gradeSubject, sgpa } from "@/lib/engine/grading";
import { resultInput, subjectInput } from "@/lib/validators";
import { requireRole, requireUser } from "../authz";
import { activeScheme, loadAcademics } from "../queries/academics";
import { AppError, handle, must } from "../result";
import { db } from "../supabase";

const id = z.string().uuid();

export async function createSemester(semesterNo: number, academicYear?: string | null) {
  return handle(async () => {
    const u = await requireRole("MENTEE");
    const no = z.number().int().min(1).max(12).parse(semesterNo);
    const supabase = await db();
    const { data: existing } = await supabase.from("academic_semesters").select("id").eq("student_id", u.id).eq("semester_no", no).maybeSingle();
    if (existing) throw new AppError("CONFLICT", `Semester ${no} already exists.`);
    const { data: sem } = await supabase
      .from("academic_semesters")
      .insert({ student_id: u.id, semester_no: no, academic_year: academicYear ?? null })
      .select("id")
      .single()
      .then((r) => ({ data: must(r) }));
    // Prefill from the department catalog for that semester
    const { data: subs } = await supabase.from("subjects").select("id, mse_max, see_max").eq("department_id", u.department_id).eq("semester", no);
    if (subs?.length)
      must(await supabase.from("student_subject_results").insert(subs.map((s) => ({ academic_semester_id: sem!.id, subject_id: s.id, mse_max: s.mse_max, see_max: s.see_max }))));
    revalidatePath("/mentee/academics");
    return { id: sem!.id, semester_no: no };
  });
}

/** Save the whole marks grid for a DRAFT semester (RLS rejects anything else). */
export async function saveResults(semesterId: string, rows: unknown[]) {
  return handle(async () => {
    const u = await requireRole("MENTEE");
    const semId = id.parse(semesterId);
    const parsed = z.array(resultInput).max(20).parse(rows);
    const supabase = await db();
    const { data: sem } = await supabase.from("academic_semesters").select("id, status, semester_no").eq("id", semId).eq("student_id", u.id).maybeSingle();
    if (!sem) throw new AppError("NOT_FOUND", "We couldn't find that semester.");
    if (sem.status !== "DRAFT") throw new AppError("FORBIDDEN", "This semester is locked. Request a correction instead.");
    const scheme = await activeScheme(u.department_id);
    const { data: subs } = await supabase.from("subjects").select("id, has_mse, has_see, mse_max, see_max").in("id", parsed.map((r) => r.subject_id));
    const byId = new Map((subs ?? []).map((s) => [s.id, s]));
    const fieldErrors: Record<string, string> = {};
    const payload = parsed.map((r, i) => {
      const s = byId.get(r.subject_id);
      const mse_max = r.mse_max ?? s?.mse_max ?? null;
      const see_max = r.see_max ?? s?.see_max ?? null;
      if (r.mse_marks != null && mse_max != null && r.mse_marks > mse_max) fieldErrors[`${i}.mse_marks`] = `Max ${mse_max}`;
      if (r.see_marks != null && see_max != null && r.see_marks > see_max) fieldErrors[`${i}.see_marks`] = `Max ${see_max}`;
      const g = s
        ? gradeSubject({ has_mse: s.has_mse, has_see: s.has_see, mse_marks: r.mse_marks, mse_max, see_marks: r.see_marks, see_max, ia: r.ia.map((c) => ({ label: c.label, marks: c.marks, max: c.max })) }, scheme).value
        : null;
      return {
        academic_semester_id: semId,
        subject_id: r.subject_id,
        mse_marks: r.mse_marks,
        mse_max,
        see_marks: r.see_marks,
        see_max,
        ia: r.ia,
        grade: r.grade ?? g?.grade ?? null,
        grade_points: r.grade_points ?? g?.points ?? null,
        result: r.result !== "PENDING" ? r.result : g ? (g.passed ? "PASS" : "FAIL") : "PENDING",
      };
    });
    if (Object.keys(fieldErrors).length) throw new AppError("VALIDATION", "Some marks are higher than the maximum.", fieldErrors);
    must(await supabase.from("student_subject_results").upsert(payload, { onConflict: "academic_semester_id,subject_id" }), "Couldn't save. Check marks don't exceed the maximum.");
    // Draft SGPA snapshot so the student sees it immediately
    const { data: subjectCredits } = await supabase.from("subjects").select("id, credits").in("id", payload.map((p) => p.subject_id));
    const credits = new Map((subjectCredits ?? []).map((s) => [s.id, s.credits == null ? null : Number(s.credits)]));
    const s = sgpa(payload.map((p) => ({ credits: credits.get(p.subject_id) ?? null, points: p.grade_points })));
    must(
      await supabase.from("semester_summaries").upsert({
        academic_semester_id: semId,
        sgpa: s.value,
        credits_registered: [...credits.values()].every((c) => c != null) ? [...credits.values()].reduce<number>((a, c) => a + (c ?? 0), 0) : null,
        computed: s.value != null,
        computation_note: s.reason ? `SGPA not calculated: ${s.reason}` : null,
      }),
    );
    revalidatePath(`/mentee/academics/${sem.semester_no}`);
    revalidatePath("/mentee");
    return { saved: payload.length, sgpa: s.value, note: s.reason };
  });
}

export async function addSubjectToSemester(semesterId: string, subjectId: string) {
  return handle(async () => {
    await requireRole("MENTEE");
    const supabase = await db();
    const { data: s } = await supabase.from("subjects").select("mse_max, see_max").eq("id", id.parse(subjectId)).single();
    must(await supabase.from("student_subject_results").insert({ academic_semester_id: id.parse(semesterId), subject_id: subjectId, mse_max: s?.mse_max, see_max: s?.see_max }), "That subject is already in this semester.");
    revalidatePath("/mentee/academics", "layout");
    return true;
  });
}

export async function removeResult(resultId: string) {
  return handle(async () => {
    await requireRole("MENTEE");
    const supabase = await db();
    const r = await supabase.from("student_subject_results").delete().eq("id", id.parse(resultId)).select("id");
    if (!must(r)?.length) throw new AppError("FORBIDDEN", "Only draft records can be removed.");
    revalidatePath("/mentee/academics", "layout");
    return true;
  });
}

/** Students may add a missing subject to their department catalog. */
export async function createSubject(input: unknown) {
  return handle(async () => {
    const u = await requireUser();
    const v = subjectInput.parse(input);
    const supabase = await db();
    const { data } = await supabase
      .from("subjects")
      .insert({ ...v, department_id: u.department_id, created_by: u.id })
      .select("id")
      .single()
      .then((r) => ({ data: must(r, "A subject with that code already exists — pick it from the list instead.") }));
    return data!.id as string;
  });
}

export async function setSemesterStatus(semesterId: string, status: "SUBMITTED" | "DRAFT") {
  return handle(async () => {
    const u = await requireRole("MENTEE");
    const supabase = await db();
    const { data: sem } = await supabase.from("academic_semesters").select("id, semester_no, status").eq("id", id.parse(semesterId)).eq("student_id", u.id).maybeSingle();
    if (!sem) throw new AppError("NOT_FOUND", "We couldn't find that semester.");
    if (status === "SUBMITTED") {
      const a = await loadAcademics(u.id, u.department_id);
      const s = a.semesters.find((x) => x.id === sem.id);
      if (!s?.results.length) throw new AppError("VALIDATION", "Add at least one subject before submitting.");
      const empty = s.results.filter((r) => r.mse_marks == null && r.see_marks == null && r.grade_points == null);
      if (empty.length) throw new AppError("VALIDATION", `${empty.length} subject${empty.length > 1 ? "s have" : " has"} no marks yet.`);
    }
    must(await supabase.from("academic_semesters").update({ status }).eq("id", sem.id));
    revalidatePath("/mentee/academics", "layout");
    return true;
  });
}

export async function deleteSemester(semesterId: string) {
  return handle(async () => {
    const u = await requireRole("MENTEE");
    const supabase = await db();
    const r = await supabase.from("academic_semesters").delete().eq("id", id.parse(semesterId)).eq("student_id", u.id).eq("status", "DRAFT").select("id");
    if (!must(r)?.length) throw new AppError("FORBIDDEN", "Only draft semesters can be deleted.");
    revalidatePath("/mentee/academics");
    return true;
  });
}

export async function requestCorrection(resultId: string, proposed: Record<string, unknown>, reason: string) {
  return handle(async () => {
    const u = await requireRole("MENTEE");
    const v = z
      .object({
        proposed: z
          .object({ mse_marks: z.number().min(0).nullable().optional(), see_marks: z.number().min(0).nullable().optional(), grade: z.string().max(4).nullable().optional(), grade_points: z.number().min(0).max(10).nullable().optional() })
          .refine((p) => Object.keys(p).length > 0, "Change at least one value"),
        reason: z.string().trim().min(5, "Tell your mentor why — e.g. re-evaluation result").max(1000),
      })
      .parse({ proposed, reason });
    const supabase = await db();
    must(
      await supabase.from("record_change_requests").insert({ student_id: u.id, target_table: "student_subject_results", target_id: id.parse(resultId), proposed: v.proposed, reason: v.reason }),
    );
    revalidatePath("/mentee/academics", "layout");
    return true;
  });
}
