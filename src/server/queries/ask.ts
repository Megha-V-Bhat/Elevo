import "server-only";
import { db } from "../supabase";

export type ThreadRow = {
  id: string;
  student_id: string;
  title: string;
  status: "OPEN" | "ANSWERED" | "RESOLVED";
  last_activity_at: string;
  created_at: string;
  first_response_at: string | null;
  mentor_seen_at: string | null;
  converted_recommendation_id: string | null;
  converted_session_id: string | null;
  subject: { id: string; code: string; name: string } | null;
  student_name?: string;
};

export type MessageRow = {
  id: string;
  author_id: string;
  body: string;
  attachment_paths: string[];
  resource_id: string | null;
  edited_at: string | null;
  created_at: string;
};

const THREAD_COLS = "id, student_id, title, status, last_activity_at, created_at, first_response_at, mentor_seen_at, converted_recommendation_id, converted_session_id, subjects(id, code, name)";

const shape = (r: Record<string, unknown>): ThreadRow => ({ ...(r as unknown as ThreadRow), subject: (r.subjects as ThreadRow["subject"]) ?? null });

export async function listThreads(opts: { studentId?: string; status?: string; subjectId?: string; unanswered48?: boolean; limit?: number } = {}) {
  const supabase = await db();
  let q = supabase.from("ask_threads").select(THREAD_COLS).order("last_activity_at", { ascending: false }).limit(opts.limit ?? 50);
  if (opts.studentId) q = q.eq("student_id", opts.studentId);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.subjectId) q = q.eq("subject_id", opts.subjectId);
  if (opts.unanswered48) q = q.eq("status", "OPEN").is("first_response_at", null).lt("created_at", new Date(Date.now() - 48 * 3600_000).toISOString());
  const { data } = await q;
  const rows = (data ?? []).map(shape);
  const ids = [...new Set(rows.map((r) => r.student_id))];
  if (ids.length) {
    const { data: names } = await supabase.from("student_profiles").select("user_id, full_name").in("user_id", ids);
    const m = new Map((names ?? []).map((n) => [n.user_id, n.full_name]));
    rows.forEach((r) => (r.student_name = m.get(r.student_id) || "Student"));
  }
  return rows;
}

export async function getThread(id: string) {
  const supabase = await db();
  const { data: t } = await supabase.from("ask_threads").select(THREAD_COLS).eq("id", id).maybeSingle();
  if (!t) return null;
  const { data: msgs } = await supabase.from("ask_messages").select("id, author_id, body, attachment_paths, resource_id, edited_at, created_at").eq("thread_id", id).order("created_at");
  const authorIds = [...new Set((msgs ?? []).map((m) => m.author_id))];
  const [{ data: sp }, { data: mp }] = await Promise.all([
    supabase.from("student_profiles").select("user_id, full_name").in("user_id", authorIds.length ? authorIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("mentor_profiles").select("user_id, full_name").in("user_id", authorIds.length ? authorIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const names = new Map([...(sp ?? []), ...(mp ?? [])].map((p) => [p.user_id, p.full_name]));
  const resIds = (msgs ?? []).map((m) => m.resource_id).filter(Boolean) as string[];
  const { data: res } = resIds.length ? await supabase.from("learning_resources").select("id, title, file_path, external_url").in("id", resIds) : { data: [] };
  return {
    thread: shape(t),
    messages: (msgs ?? []) as MessageRow[],
    names,
    resources: new Map((res ?? []).map((r) => [r.id, r as { id: string; title: string; file_path: string | null; external_url: string | null }])),
  };
}
