"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recommendationInput, sessionComplete, sessionInput } from "@/lib/validators";
import { rateLimit } from "../admin/ratelimit";
import { assertCanEditMentoring, requireRole } from "../authz";
import { safeName, validateFile } from "../files";
import { menteeIds } from "../queries/people";
import { AppError, handle, must } from "../result";
import { db } from "../supabase";

const uuid = z.string().uuid();
const refresh = () => {
  revalidatePath("/mentor", "layout");
  revalidatePath("/mentee", "layout");
};

// ───────────── Recommendations, feedback, goals ─────────────
export async function createRecommendation(input: unknown) {
  return handle(async () => {
    const v = recommendationInput.parse(input);
    const u = await assertCanEditMentoring(v.student_id);
    const supabase = await db();
    const { data } = await supabase
      .from("mentor_recommendations")
      .insert({ ...v, mentor_id: u.id, include_in_report: v.visibility === "SHARED" && v.include_in_report })
      .select("id")
      .single()
      .then((r) => ({ data: must(r) }));
    if (v.source === "ASK_THREAD" && v.source_id) await supabase.from("ask_threads").update({ converted_recommendation_id: data!.id }).eq("id", v.source_id);
    refresh();
    return data!.id as string;
  });
}

export async function updateRecommendation(id: string, patch: Record<string, unknown>) {
  return handle(async () => {
    await requireRole("MENTOR");
    const v = z
      .object({
        status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
        include_in_report: z.boolean().optional(),
        visibility: z.enum(["SHARED", "PRIVATE_MENTOR"]).optional(),
        title: z.string().trim().min(2).max(160).optional(),
        body: z.string().max(5000).optional(),
        due_date: z.string().nullable().optional(),
        review_date: z.string().nullable().optional(),
      })
      .parse(patch);
    const supabase = await db();
    const r = await supabase.from("mentor_recommendations").update(v).eq("id", uuid.parse(id)).select("id");
    if (!must(r)?.length) throw new AppError("FORBIDDEN", "You can only update records for your current mentees.");
    refresh();
    return true;
  });
}

export async function deleteRecommendation(id: string) {
  return handle(async () => {
    await requireRole("MENTOR");
    const supabase = await db();
    const r = await supabase.from("mentor_recommendations").delete().eq("id", uuid.parse(id)).select("id");
    if (!must(r)?.length) throw new AppError("FORBIDDEN", "Only the author can delete this.");
    refresh();
    return true;
  });
}

export async function studentUpdateItem(id: string, status: "PENDING" | "IN_PROGRESS" | "COMPLETED", steps?: { label: string; done: boolean }[], reflection?: string) {
  return handle(async () => {
    await requireRole("MENTEE");
    const supabase = await db();
    must(
      await supabase.rpc("student_update_item", {
        p_id: uuid.parse(id),
        p_status: status,
        p_steps: steps ? z.array(z.object({ label: z.string().max(120), done: z.boolean() })).max(12).parse(steps) : null,
        p_reflection: reflection ? z.string().max(2000).parse(reflection) : null,
      }),
    );
    refresh();
    return true;
  });
}

// ───────────── Learning resources ─────────────
export async function uploadResource(form: FormData) {
  return handle(async () => {
    const u = await requireRole("MENTOR");
    const v = z
      .object({
        title: z.string().trim().min(2, "Add a title").max(160),
        instructions: z.string().trim().max(3000).default(""),
        student_id: uuid.nullable(),
        subject_id: uuid.nullable(),
        external_url: z.string().trim().url("Enter a full link starting with https://").nullable(),
      })
      .parse({
        title: form.get("title"),
        instructions: form.get("instructions") ?? "",
        student_id: form.get("student_id") || null,
        subject_id: form.get("subject_id") || null,
        external_url: form.get("external_url") || null,
      });
    if (v.student_id) await assertCanEditMentoring(v.student_id);
    if (!(await rateLimit("upload", u.id, 40, 3600))) throw new AppError("RATE_LIMITED", "Too many uploads this hour. Try again later.");
    const file = form.get("file");
    const supabase = await db();
    let file_path: string | null = null;
    let mime: string | null = null;
    let size: number | null = null;
    if (file instanceof File && file.size > 0) {
      const problem = await validateFile("resources", file);
      if (problem) throw new AppError("VALIDATION", problem, { file: problem });
      file_path = `${u.id}/${crypto.randomUUID().slice(0, 8)}-${safeName(file.name)}`;
      const up = await supabase.storage.from("resources").upload(file_path, file, { contentType: file.type });
      if (up.error) throw new AppError("INTERNAL", "Upload failed. Check your connection and try again.");
      mime = file.type;
      size = file.size;
    }
    if (!file_path && !v.external_url) throw new AppError("VALIDATION", "Attach a file or add a link.", { file: "Attach a file or add a link" });
    const { data } = await supabase
      .from("learning_resources")
      .insert({ mentor_id: u.id, ...v, file_path, mime, size_bytes: size })
      .select("id")
      .single()
      .then((r) => ({ data: must(r) }));
    refresh();
    return data!.id as string;
  });
}

export async function deleteResource(id: string) {
  return handle(async () => {
    await requireRole("MENTOR");
    const supabase = await db();
    const r = await supabase.from("learning_resources").delete().eq("id", uuid.parse(id)).select("file_path");
    const path = must(r)?.[0]?.file_path;
    if (path) await supabase.storage.from("resources").remove([path]);
    refresh();
    return true;
  });
}

export async function markSeen(entityType: "learning_resources" | "mentor_recommendations", ids: string[]) {
  return handle(async () => {
    const u = await requireRole("MENTEE");
    if (!ids.length) return true;
    const supabase = await db();
    must(await supabase.from("content_views").upsert(z.array(uuid).max(200).parse(ids).map((entity_id) => ({ user_id: u.id, entity_type: entityType, entity_id }))));
    revalidatePath("/mentee", "layout");
    return true;
  });
}

// ───────────── Sessions ─────────────
export async function scheduleSession(input: unknown) {
  return handle(async () => {
    const v = sessionInput.parse(input);
    const u = await assertCanEditMentoring(v.student_id);
    const at = new Date(v.scheduled_at);
    if (Number.isNaN(at.getTime())) throw new AppError("VALIDATION", "Choose a valid date and time.", { scheduled_at: "Choose a valid date and time" });
    const supabase = await db();
    const { data } = await supabase
      .from("mentoring_sessions")
      .insert({ ...v, scheduled_at: at.toISOString(), mentor_id: u.id })
      .select("id")
      .single()
      .then((r) => ({ data: must(r) }));
    if (v.source_thread_id) await supabase.from("ask_threads").update({ converted_session_id: data!.id }).eq("id", v.source_thread_id);
    refresh();
    return data!.id as string;
  });
}

export async function rescheduleSession(id: string, scheduledAt: string | null, cancel = false) {
  return handle(async () => {
    await requireRole("MENTOR");
    const supabase = await db();
    const patch = cancel ? { status: "CANCELLED" } : { scheduled_at: new Date(z.string().parse(scheduledAt)).toISOString(), status: "SCHEDULED" };
    const r = await supabase.from("mentoring_sessions").update(patch).eq("id", uuid.parse(id)).select("id");
    if (!must(r)?.length) throw new AppError("FORBIDDEN", "You can only change sessions with your current mentees.");
    refresh();
    return true;
  });
}

/** Completing a session turns agreed action items into ACTION_POINT recommendations. */
export async function completeSession(input: unknown) {
  return handle(async () => {
    const v = sessionComplete.parse(input);
    const supabase = await db();
    const { data: s } = await supabase.from("mentoring_sessions").select("id, student_id").eq("id", v.id).maybeSingle();
    if (!s) throw new AppError("NOT_FOUND", "We couldn't find that session.");
    const u = await assertCanEditMentoring(s.student_id);
    must(
      await supabase
        .from("mentoring_sessions")
        .update({ status: "COMPLETED", summary: v.summary, action_items: v.action_items.map((t) => ({ label: t })), next_follow_up_date: v.next_follow_up_date })
        .eq("id", v.id),
    );
    if (v.action_items.length)
      must(
        await supabase.from("mentor_recommendations").insert(
          v.action_items.map((t) => ({
            student_id: s.student_id,
            mentor_id: u.id,
            kind: "ACTION_POINT",
            category: "ACADEMIC_PROGRESS",
            title: t,
            source: "SESSION",
            source_id: v.id,
            review_date: v.next_follow_up_date,
          })),
        ),
      );
    refresh();
    return true;
  });
}

export async function myMenteeIds() {
  return handle(async () => {
    const u = await requireRole("MENTOR");
    return menteeIds(u.id);
  });
}
