"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { gradeSubject } from "@/lib/engine/grading";
import { hodSetup, mentorSetup, studentAbout, studentAcademic, studentHistory, studentPersonal } from "@/lib/validators";
import { HOME, requireUser } from "../authz";
import { safeName, validateFile } from "../files";
import { activeScheme, subjectCatalog } from "../queries/academics";
import { completion } from "../queries/people";
import { AppError, handle, must } from "../result";
import { db } from "../supabase";

const profileTable = (role: string) => (role === "MENTEE" ? "student_profiles" : "mentor_profiles");

/** Debounced wizard autosave. Stores the raw draft so the wizard resumes exactly where it was. */
export async function saveDraft(draft: Record<string, unknown>, step: number) {
  return handle(async () => {
    const u = await requireUser();
    const supabase = await db();
    const payload = { draft: { ...draft, _step: step, _saved_at: new Date().toISOString() } };
    must(await supabase.from(profileTable(u.role)).upsert({ user_id: u.id, ...payload }, { onConflict: "user_id" }));
    return new Date().toISOString();
  });
}

export async function uploadAvatar(form: FormData) {
  return handle(async () => {
    const u = await requireUser();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "Choose a photo to upload.");
    const problem = await validateFile("avatars", file);
    if (problem) throw new AppError("VALIDATION", problem);
    const supabase = await db();
    const path = `${u.id}/avatar-${Date.now()}.${safeName(file.name).split(".").pop()}`;
    const up = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) throw new AppError("INTERNAL", "Upload failed. Check your connection and try again.");
    const { data: prev } = await supabase.from(profileTable(u.role)).select("avatar_path").eq("user_id", u.id).maybeSingle();
    must(await supabase.from(profileTable(u.role)).upsert({ user_id: u.id, avatar_path: path }, { onConflict: "user_id" }));
    if (prev?.avatar_path) await supabase.storage.from("avatars").remove([prev.avatar_path]);
    const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60);
    revalidatePath("/", "layout");
    return { path, url: signed?.signedUrl ?? null };
  });
}

/** Final step of the setup wizard: validate everything server-side, write it, and mark onboarding complete. */
export async function finishSetup(data: Record<string, unknown>) {
  const res = await handle(async () => {
    const u = await requireUser();
    const supabase = await db();
    const now = new Date().toISOString();

    if (u.role === "MENTEE") {
      const personal = studentPersonal.parse(data);
      const academic = studentAcademic.parse(data);
      const about = studentAbout.parse(data);
      const history = studentHistory.parse(data);
      const { data: existing } = await supabase.from("student_profiles").select("avatar_path, created_at").eq("user_id", u.id).maybeSingle();

      // Academic history → DRAFT semesters the mentor will verify later
      const scheme = await activeScheme(u.department_id);
      const catalog = new Map((await subjectCatalog(u.department_id)).map((s) => [s.id, s]));
      for (const s of history.semesters) {
        const { data: sem } = await supabase
          .from("academic_semesters")
          .upsert({ student_id: u.id, semester_no: s.semester_no, academic_year: s.academic_year }, { onConflict: "student_id,semester_no" })
          .select("id, status")
          .single();
        if (!sem || sem.status !== "DRAFT") continue;
        if (s.mode === "subjects") {
          for (const r of s.results) {
            const subj = catalog.get(r.subject_id);
            if (!subj) continue;
            const marks = { has_mse: subj.has_mse, has_see: subj.has_see, mse_marks: r.mse_marks, mse_max: subj.mse_max, see_marks: r.see_marks, see_max: subj.see_max, ia: [] };
            const g = gradeSubject(marks, scheme).value;
            must(
              await supabase.from("student_subject_results").upsert(
                {
                  academic_semester_id: sem.id,
                  subject_id: r.subject_id,
                  mse_marks: r.mse_marks,
                  mse_max: subj.mse_max,
                  see_marks: r.see_marks,
                  see_max: subj.see_max,
                  grade: r.grade ?? g?.grade ?? null,
                  grade_points: r.grade_points ?? g?.points ?? null,
                  result: g ? (g.passed ? "PASS" : "FAIL") : "PENDING",
                },
                { onConflict: "academic_semester_id,subject_id" },
              ),
              "Couldn't save a subject result. Check marks don't exceed the maximum.",
            );
          }
        } else if (s.manual_sgpa != null) {
          must(
            await supabase.from("semester_summaries").upsert({
              academic_semester_id: sem.id,
              sgpa: s.manual_sgpa,
              credits_registered: s.manual_credits,
              computed: false,
              computation_note: "Entered manually during setup — unverified",
            }),
          );
        }
      }

      const merged = { ...personal, ...academic, ...about, avatar_path: existing?.avatar_path ?? null, department_id: u.department_id };
      must(
        await supabase.from("student_profiles").upsert(
          { user_id: u.id, ...merged, profile_completion: completion(merged, history.semesters.length), draft: {} },
          { onConflict: "user_id" },
        ),
        "We couldn't save your profile. If your USN is already registered, contact your HOD.",
      );
    } else {
      const v = u.role === "MENTOR" ? mentorSetup.parse(data) : hodSetup.parse(data);
      must(await supabase.from("mentor_profiles").upsert({ user_id: u.id, ...v, department_id: u.department_id, draft: {} }, { onConflict: "user_id" }), "We couldn't save your profile. Is that faculty ID already used?");
    }
    must(await supabase.from("users").update({ onboarding_completed_at: now }).eq("id", u.id));
    return HOME[u.role];
  });
  if (res.ok) {
    revalidatePath("/", "layout");
    return { ok: true as const, data: res.data };
  }
  return res;
}

export async function goHome() {
  const u = await requireUser();
  redirect(HOME[u.role]);
}

export async function updateProfile(section: "personal" | "about" | "mentor", data: Record<string, unknown>) {
  return handle(async () => {
    const u = await requireUser();
    const supabase = await db();
    if (section === "mentor") {
      const v = (u.role === "MENTOR" ? mentorSetup : hodSetup).parse(data);
      must(await supabase.from("mentor_profiles").update(v).eq("user_id", u.id));
    } else {
      if (u.role !== "MENTEE") throw new AppError("FORBIDDEN", "Only students have this section.");
      const v = section === "personal" ? studentPersonal.parse(data) : studentAbout.parse(data);
      must(await supabase.from("student_profiles").update(v).eq("user_id", u.id));
      const { data: p } = await supabase.from("student_profiles").select("*").eq("user_id", u.id).single();
      const { count } = await supabase.from("academic_semesters").select("id", { count: "exact", head: true }).eq("student_id", u.id);
      must(await supabase.from("student_profiles").update({ profile_completion: completion(p ?? {}, count ?? 0) }).eq("user_id", u.id));
    }
    revalidatePath("/", "layout");
    return true;
  });
}

export async function updatePrefs(prefs: Record<string, boolean>) {
  return handle(async () => {
    const u = await requireUser();
    const v = z.record(z.string().max(40), z.boolean()).parse(prefs);
    const supabase = await db();
    must(await supabase.from("users").update({ notification_prefs: v }).eq("id", u.id));
    return true;
  });
}

export async function changePassword(current: string, next: string) {
  return handle(async () => {
    const u = await requireUser();
    const pw = z.string().min(10, "Use at least 10 characters").regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a number").parse(next);
    const supabase = await db();
    const check = await supabase.auth.signInWithPassword({ email: u.email, password: current });
    if (check.error) throw new AppError("VALIDATION", "Your current password isn't right.", { current: "Your current password isn't right." });
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) throw new AppError("VALIDATION", "Choose a different password.");
    return true;
  });
}
