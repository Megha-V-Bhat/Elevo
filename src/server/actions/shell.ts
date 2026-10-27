"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "../authz";
import { handle, must } from "../result";
import { db } from "../supabase";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  snoozed_until: string | null;
  created_at: string;
};

export async function listNotifications(limit = 30) {
  return handle(async () => {
    await requireUser();
    const supabase = await db();
    const now = new Date().toISOString();
    const rows = must(
      await supabase
        .from("notifications")
        .select("id, type, title, body, link, read_at, snoozed_until, created_at")
        .or(`snoozed_until.is.null,snoozed_until.lt.${now}`)
        .order("created_at", { ascending: false })
        .limit(limit),
    ) as NotificationRow[];
    const unread = rows.filter((r) => !r.read_at).length;
    return { rows, unread };
  });
}

export async function markNotifications(ids: string[] | "all") {
  return handle(async () => {
    const u = await requireUser();
    const supabase = await db();
    let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", u.id).is("read_at", null);
    if (ids !== "all") q = q.in("id", z.array(z.string().uuid()).max(200).parse(ids));
    must(await q);
    revalidatePath("/notifications");
    return true;
  });
}

export async function snoozeNotification(id: string) {
  return handle(async () => {
    await requireUser();
    const supabase = await db();
    const until = new Date(Date.now() + 86_400_000).toISOString();
    must(await supabase.from("notifications").update({ snoozed_until: until, read_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(id)));
    revalidatePath("/notifications");
    return true;
  });
}

export type SearchHit = { id: string; label: string; sub: string; href: string };

/** ⌘K search over people the caller is allowed to see (RLS limits results automatically). */
export async function searchPeople(query: string) {
  return handle(async () => {
    const u = await requireUser();
    const q = z.string().trim().max(60).parse(query);
    if (q.length < 2 || u.role === "MENTEE") return [] as SearchHit[];
    const supabase = await db();
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    const rows = must(
      await supabase.from("student_profiles").select("user_id, full_name, usn, current_semester, section").or(`full_name.ilike.${like},usn.ilike.${like}`).limit(8),
    ) as { user_id: string; full_name: string; usn: string | null; current_semester: number | null; section: string | null }[];
    const hits: SearchHit[] = rows.map((r) => ({
      id: r.user_id,
      label: r.full_name || "Unnamed student",
      sub: [r.usn, r.current_semester && `Sem ${r.current_semester}`, r.section].filter(Boolean).join(" · "),
      href: u.role === "HOD" ? `/hod/students/${r.user_id}` : `/mentor/mentees/${r.user_id}`,
    }));
    if (u.role === "HOD") {
      const m = must(await supabase.from("mentor_profiles").select("user_id, full_name, designation").ilike("full_name", like).limit(5)) as {
        user_id: string;
        full_name: string;
        designation: string | null;
      }[];
      hits.push(...m.map((r) => ({ id: r.user_id, label: r.full_name, sub: r.designation ?? "Mentor", href: `/hod/mentors/${r.user_id}` })));
    }
    return hits;
  });
}

export async function signOut(everywhere = false) {
  const supabase = await db();
  await supabase.auth.signOut({ scope: everywhere ? "global" : "local" });
  redirect("/login");
}
