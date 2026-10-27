import "server-only";
import { cache } from "react";
import { db } from "../supabase";

export type DirectoryFilters = { q?: string; sem?: string; section?: string; year?: string; status?: string; mentor?: string; completion?: string; risk?: string; sort?: string; page?: string };

export type DirectoryRow = {
  user_id: string;
  full_name: string;
  usn: string | null;
  current_semester: number | null;
  section: string | null;
  admission_year: number | null;
  profile_completion: number;
  status: string;
  mentor_id: string | null;
  mentor_name: string | null;
};

export const PAGE_SIZE = 20;

/** Server-side filtered, sorted, paginated student directory (HOD; RLS limits rows). */
export async function studentDirectory(f: DirectoryFilters, restrictIds?: string[]) {
  const supabase = await db();
  const page = Math.max(1, Number(f.page) || 1);
  let q = supabase
    .from("student_profiles")
    .select("user_id, full_name, usn, current_semester, section, admission_year, profile_completion, users!inner(status)", { count: "exact" });
  if (f.q) {
    const like = `%${f.q.replace(/[%_,()]/g, " ")}%`;
    q = q.or(`full_name.ilike.${like},usn.ilike.${like}`);
  }
  if (f.sem) q = q.eq("current_semester", Number(f.sem));
  if (f.section) q = q.eq("section", f.section);
  if (f.year) q = q.eq("admission_year", Number(f.year));
  if (f.status) q = q.eq("users.status", f.status);
  if (f.completion === "incomplete") q = q.lt("profile_completion", 80);
  if (restrictIds) q = q.in("user_id", restrictIds.length ? restrictIds.slice(0, 300) : ["00000000-0000-0000-0000-000000000000"]);
  if (f.mentor === "unassigned" || (f.mentor && f.mentor !== "unassigned")) {
    const { data: a } = await supabase.from("mentor_assignments").select("student_id, mentor_id").is("ended_at", null);
    const assigned = (a ?? []).filter((x) => f.mentor === "unassigned" || x.mentor_id === f.mentor).map((x) => x.student_id);
    if (f.mentor === "unassigned") {
      if (assigned.length) q = q.not("user_id", "in", `(${assigned.join(",")})`);
    } else q = q.in("user_id", assigned.length ? assigned : ["00000000-0000-0000-0000-000000000000"]);
  }
  const [col, dir] = (f.sort ?? "full_name.asc").split(".");
  q = q.order(["full_name", "usn", "current_semester", "profile_completion", "section"].includes(col) ? col : "full_name", { ascending: dir !== "desc" });
  const { data, count } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as (Omit<DirectoryRow, "status" | "mentor_id" | "mentor_name"> & { users: { status: string } })[];
  const ids = rows.map((r) => r.user_id);
  const { data: asg } = ids.length ? await supabase.from("mentor_assignments").select("student_id, mentor_id").in("student_id", ids).is("ended_at", null) : { data: [] };
  const mids = [...new Set((asg ?? []).map((x) => x.mentor_id))];
  const { data: mp } = mids.length ? await supabase.from("mentor_profiles").select("user_id, full_name").in("user_id", mids) : { data: [] };
  const mname = new Map((mp ?? []).map((m) => [m.user_id, m.full_name]));
  const mOf = new Map((asg ?? []).map((x) => [x.student_id, x.mentor_id]));
  return {
    rows: rows.map((r) => ({ ...r, status: r.users?.status ?? "ACTIVE", mentor_id: mOf.get(r.user_id) ?? null, mentor_name: mname.get(mOf.get(r.user_id) ?? "") ?? null })) as DirectoryRow[],
    total: count ?? 0,
    page,
    pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
  };
}

export const allStudentIds = cache(async () => {
  const supabase = await db();
  const out: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("student_profiles").select("user_id").range(from, from + 999);
    out.push(...(data ?? []).map((r) => r.user_id));
    if (!data || data.length < 1000) break;
  }
  return out;
});

export type MentorActivity = {
  mentor_id: string;
  full_name: string;
  designation: string | null;
  capacity: number;
  mentees: number;
  feedback_30d: number;
  sessions_30d: number;
  last_activity: string | null;
  median_first_response_hours: number | null;
  pulse_participation_pct: number | null;
  open_threads: number;
};

export const mentorActivity = cache(async () => {
  const supabase = await db();
  const { data } = await supabase.rpc("hod_mentor_activity");
  return ((data ?? []) as MentorActivity[]).map((m) => ({ ...m, median_first_response_hours: m.median_first_response_hours == null ? null : Number(m.median_first_response_hours), pulse_participation_pct: m.pulse_participation_pct == null ? null : Number(m.pulse_participation_pct) }));
});

export const activeAssignments = cache(async () => {
  const supabase = await db();
  const { data } = await supabase.from("mentor_assignments").select("id, student_id, mentor_id, started_at").is("ended_at", null);
  return (data ?? []) as { id: string; student_id: string; mentor_id: string; started_at: string }[];
});

export async function savedViews(scope: string) {
  const supabase = await db();
  const { data } = await supabase.from("saved_views").select("id, name, filters").eq("scope", scope).order("created_at");
  return (data ?? []) as { id: string; name: string; filters: Record<string, string> }[];
}

export const sectionsList = cache(async () => {
  const supabase = await db();
  const { data } = await supabase.from("sections").select("name").order("name");
  return (data ?? []).map((s) => s.name as string);
});
