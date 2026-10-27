"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { askReplyInput, askThreadInput } from "@/lib/validators";
import { rateLimit } from "../admin/ratelimit";
import { assertCanViewThread, requireRole } from "../authz";
import { safeName, validateFile } from "../files";
import { AppError, handle, must } from "../result";
import { db } from "../supabase";

async function uploadAttachments(studentId: string, threadId: string, files: File[]) {
  if (files.length > 3) throw new AppError("VALIDATION", "Attach up to 3 files.");
  for (const f of files) {
    const p = await validateFile("ask-attachments", f);
    if (p) throw new AppError("VALIDATION", `${f.name}: ${p}`);
  }
  const supabase = await db();
  const paths: string[] = [];
  for (const f of files) {
    const path = `${studentId}/${threadId}/${crypto.randomUUID().slice(0, 8)}-${safeName(f.name)}`;
    const up = await supabase.storage.from("ask-attachments").upload(path, f, { contentType: f.type });
    if (up.error) throw new AppError("INTERNAL", `Couldn't upload ${f.name}. Try again.`);
    paths.push(path);
  }
  return paths;
}

const filesOf = (form: FormData) => form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

export async function createThread(form: FormData) {
  return handle(async () => {
    const u = await requireRole("MENTEE");
    const v = askThreadInput.parse({ title: form.get("title"), body: form.get("body"), subject_id: form.get("subject_id") || null });
    if (!(await rateLimit("ask", u.id, 10, 86400))) throw new AppError("RATE_LIMITED", "You've asked a lot today. Try again tomorrow.");
    const supabase = await db();
    const { data: t } = await supabase
      .from("ask_threads")
      .insert({ student_id: u.id, title: v.title, subject_id: v.subject_id })
      .select("id")
      .single()
      .then((r) => ({ data: must(r) }));
    const paths = await uploadAttachments(u.id, t!.id, filesOf(form));
    must(await supabase.from("ask_messages").insert({ thread_id: t!.id, author_id: u.id, body: v.body, attachment_paths: paths }));
    revalidatePath("/mentee/ask");
    return t!.id as string;
  });
}

export async function replyToThread(form: FormData) {
  return handle(async () => {
    const v = askReplyInput.parse({ thread_id: form.get("thread_id"), body: form.get("body"), resource_id: form.get("resource_id") || null });
    const { user, studentId } = await assertCanViewThread(v.thread_id);
    if (!(await rateLimit("ask-reply", user.id, 60, 3600))) throw new AppError("RATE_LIMITED", "Too many messages. Take a short break and try again.");
    const paths = await uploadAttachments(studentId, v.thread_id, filesOf(form));
    const supabase = await db();
    must(await supabase.from("ask_messages").insert({ thread_id: v.thread_id, author_id: user.id, body: v.body, attachment_paths: paths, resource_id: v.resource_id }), "You can't reply to this question.");
    revalidatePath(`/mentee/ask/${v.thread_id}`);
    revalidatePath(`/mentor/inbox/${v.thread_id}`);
    return true;
  });
}

export async function editMessage(messageId: string, body: string) {
  return handle(async () => {
    await requireRole("MENTEE", "MENTOR");
    const text = z.string().trim().min(1).max(5000).parse(body);
    const supabase = await db();
    must(await supabase.from("ask_messages").update({ body: text }).eq("id", z.string().uuid().parse(messageId)));
    revalidatePath("/mentee/ask", "layout");
    revalidatePath("/mentor/inbox", "layout");
    return true;
  });
}

export async function setThreadStatus(threadId: string, status: "RESOLVED" | "OPEN") {
  return handle(async () => {
    await assertCanViewThread(z.string().uuid().parse(threadId));
    const supabase = await db();
    must(await supabase.from("ask_threads").update({ status }).eq("id", threadId));
    revalidatePath("/mentee/ask", "layout");
    revalidatePath("/mentor/inbox", "layout");
    return true;
  });
}

export async function markThreadSeen(threadId: string) {
  return handle(async () => {
    await requireRole("MENTOR");
    const supabase = await db();
    await supabase.from("ask_threads").update({ mentor_seen_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(threadId)).is("mentor_seen_at", null);
    return true;
  });
}

export async function linkThread(threadId: string, link: { recommendation_id?: string; session_id?: string }) {
  return handle(async () => {
    await requireRole("MENTOR");
    const supabase = await db();
    must(
      await supabase
        .from("ask_threads")
        .update({ ...(link.recommendation_id ? { converted_recommendation_id: link.recommendation_id } : {}), ...(link.session_id ? { converted_session_id: link.session_id } : {}) })
        .eq("id", z.string().uuid().parse(threadId)),
    );
    revalidatePath(`/mentor/inbox/${threadId}`);
    return true;
  });
}
