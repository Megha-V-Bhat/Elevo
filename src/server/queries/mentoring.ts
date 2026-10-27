import "server-only";
import { db } from "../supabase";

export type RecRow = {
  id: string;
  student_id: string;
  mentor_id: string;
  kind: "RECOMMENDATION" | "FEEDBACK" | "GOAL" | "ACTION_POINT" | "STRENGTH" | "IMPROVEMENT_AREA";
  category: "ACADEMIC_PROGRESS" | "CAREER_GUIDANCE" | "PERSONAL_DEVELOPMENT" | "STUDY_HABITS";
  title: string;
  body: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  due_date: string | null;
  review_date: string | null;
  visibility: "SHARED" | "PRIVATE_MENTOR";
  include_in_report: boolean;
  source: string;
  target: string | null;
  steps: { label: string; done: boolean }[];
  reflection: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  subject: { code: string; name: string } | null;
  seen?: boolean;
};

const REC_COLS = "id, student_id, mentor_id, kind, category, title, body, status, due_date, review_date, visibility, include_in_report, source, target, steps, reflection, completed_at, created_at, updated_at, subjects(code, name)";

export async function recommendations(opts: { studentId?: string; mentorId?: string; kinds?: string[]; status?: string; limit?: number; viewerId?: string }) {
  const supabase = await db();
  let q = supabase.from("mentor_recommendations").select(REC_COLS).order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.studentId) q = q.eq("student_id", opts.studentId);
  if (opts.mentorId) q = q.eq("mentor_id", opts.mentorId);
  if (opts.kinds?.length) q = q.in("kind", opts.kinds);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q;
  const rows = (data ?? []).map((r) => ({ ...(r as unknown as RecRow), subject: (r as unknown as { subjects: RecRow["subject"] }).subjects ?? null, steps: (r.steps as RecRow["steps"]) ?? [] }));
  if (opts.viewerId && rows.length) {
    const { data: seen } = await supabase.from("content_views").select("entity_id").eq("user_id", opts.viewerId).eq("entity_type", "mentor_recommendations").in("entity_id", rows.map((r) => r.id));
    const s = new Set((seen ?? []).map((x) => x.entity_id));
    rows.forEach((r) => (r.seen = s.has(r.id)));
  }
  return rows;
}

export type ResourceRow = {
  id: string;
  mentor_id: string;
  student_id: string | null;
  title: string;
  instructions: string;
  file_path: string | null;
  mime: string | null;
  size_bytes: number | null;
  external_url: string | null;
  created_at: string;
  subject: { id: string; code: string; name: string } | null;
  seen?: boolean;
};

export async function resources(opts: { mentorId?: string; viewerId?: string; studentId?: string; subjectId?: string; limit?: number }) {
  const supabase = await db();
  let q = supabase.from("learning_resources").select("id, mentor_id, student_id, title, instructions, file_path, mime, size_bytes, external_url, created_at, subjects(id, code, name)").order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.mentorId) q = q.eq("mentor_id", opts.mentorId);
  if (opts.studentId) q = q.or(`student_id.eq.${opts.studentId},student_id.is.null`);
  if (opts.subjectId) q = q.eq("subject_id", opts.subjectId);
  const { data } = await q;
  const rows = (data ?? []).map((r) => ({ ...(r as unknown as ResourceRow), subject: (r as unknown as { subjects: ResourceRow["subject"] }).subjects ?? null }));
  if (opts.viewerId && rows.length) {
    const { data: seen } = await supabase.from("content_views").select("entity_id").eq("user_id", opts.viewerId).eq("entity_type", "learning_resources").in("entity_id", rows.map((r) => r.id));
    const s = new Set((seen ?? []).map((x) => x.entity_id));
    rows.forEach((r) => (r.seen = s.has(r.id)));
  }
  return rows;
}

export type SessionRow = {
  id: string;
  mentor_id: string;
  student_id: string;
  scheduled_at: string;
  duration_min: number;
  mode: "IN_PERSON" | "ONLINE";
  location_or_link: string | null;
  agenda: string;
  summary: string | null;
  action_items: { label: string }[];
  next_follow_up_date: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  student_name?: string;
  mentor_name?: string;
};

export async function sessions(opts: { studentId?: string; mentorId?: string; upcoming?: boolean; limit?: number }) {
  const supabase = await db();
  let q = supabase.from("mentoring_sessions").select("*").order("scheduled_at", { ascending: !!opts.upcoming }).limit(opts.limit ?? 100);
  if (opts.studentId) q = q.eq("student_id", opts.studentId);
  if (opts.mentorId) q = q.eq("mentor_id", opts.mentorId);
  if (opts.upcoming) q = q.eq("status", "SCHEDULED").gte("scheduled_at", new Date(Date.now() - 3600_000).toISOString());
  const { data } = await q;
  const rows = (data ?? []) as SessionRow[];
  const sids = [...new Set(rows.map((r) => r.student_id))];
  const mids = [...new Set(rows.map((r) => r.mentor_id))];
  const [{ data: sp }, { data: mp }] = await Promise.all([
    sids.length ? supabase.from("student_profiles").select("user_id, full_name").in("user_id", sids) : Promise.resolve({ data: [] }),
    mids.length ? supabase.from("mentor_profiles").select("user_id, full_name").in("user_id", mids) : Promise.resolve({ data: [] }),
  ]);
  const sn = new Map((sp ?? []).map((x) => [x.user_id, x.full_name]));
  const mn = new Map((mp ?? []).map((x) => [x.user_id, x.full_name]));
  rows.forEach((r) => {
    r.student_name = sn.get(r.student_id) || "Student";
    r.mentor_name = mn.get(r.mentor_id) || "Mentor";
  });
  return rows;
}

export const KIND_LABEL: Record<RecRow["kind"], string> = {
  RECOMMENDATION: "Recommendation",
  FEEDBACK: "Feedback",
  GOAL: "Goal",
  ACTION_POINT: "Action point",
  STRENGTH: "Strength",
  IMPROVEMENT_AREA: "Area to improve",
};

export const CATEGORY_LABEL: Record<RecRow["category"], string> = {
  ACADEMIC_PROGRESS: "Academic progress",
  CAREER_GUIDANCE: "Career guidance",
  PERSONAL_DEVELOPMENT: "Personal development",
  STUDY_HABITS: "Study habits",
};
