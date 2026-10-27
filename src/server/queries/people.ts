import "server-only";
import { cache } from "react";
import { db } from "../supabase";
import { signedUrl } from "../files";

export type StudentProfile = {
  user_id: string;
  full_name: string;
  avatar_path: string | null;
  avatar_url: string | null;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  usn: string | null;
  department_id: string | null;
  program: string | null;
  current_semester: number | null;
  section: string | null;
  admission_year: number | null;
  expected_graduation_year: number | null;
  skills: string[];
  interests: string[];
  career_goals: string | null;
  achievements: string | null;
  support_areas: string | null;
  profile_completion: number;
  created_at: string | null;
  email?: string;
};

export type MentorCard = {
  user_id: string;
  full_name: string;
  designation: string | null;
  expertise: string[];
  official_email: string | null;
  phone: string | null;
  avatar_url: string | null;
  assigned_since: string | null;
};

export const studentProfile = cache(async (id: string): Promise<StudentProfile | null> => {
  const supabase = await db();
  const { data } = await supabase.from("student_profiles").select("*, users!inner(email)").eq("user_id", id).maybeSingle();
  if (!data) return null;
  const { users, ...rest } = data as Record<string, unknown> & { users: { email: string } };
  return { ...(rest as unknown as StudentProfile), email: users?.email, avatar_url: await signedUrl("avatars", rest.avatar_path as string) };
});

export const mentorOf = cache(async (studentId: string): Promise<MentorCard | null> => {
  const supabase = await db();
  const { data: a } = await supabase.from("mentor_assignments").select("mentor_id, started_at").eq("student_id", studentId).is("ended_at", null).maybeSingle();
  if (!a) return null;
  const { data: m } = await supabase
    .from("mentor_profiles")
    .select("user_id, full_name, designation, expertise, official_email, phone, avatar_path")
    .eq("user_id", a.mentor_id)
    .maybeSingle();
  if (!m) return { user_id: a.mentor_id, full_name: "Your mentor", designation: null, expertise: [], official_email: null, phone: null, avatar_url: null, assigned_since: a.started_at };
  return { ...m, avatar_url: await signedUrl("avatars", m.avatar_path), assigned_since: a.started_at } as MentorCard;
});

/** Active mentee ids for a mentor. */
export const menteeIds = cache(async (mentorId: string) => {
  const supabase = await db();
  const { data } = await supabase.from("mentor_assignments").select("student_id").eq("mentor_id", mentorId).is("ended_at", null);
  return (data ?? []).map((r) => r.student_id as string);
});

export async function menteeProfiles(mentorId: string) {
  const ids = await menteeIds(mentorId);
  if (!ids.length) return [] as StudentProfile[];
  const supabase = await db();
  const { data } = await supabase.from("student_profiles").select("*").in("user_id", ids).order("full_name");
  return Promise.all(((data ?? []) as StudentProfile[]).map(async (p) => ({ ...p, avatar_url: await signedUrl("avatars", p.avatar_path) })));
}

/** Profile completeness: share of the important fields filled. */
export function completion(p: Partial<StudentProfile>, academicsCount: number) {
  const fields: unknown[] = [p.full_name, p.phone, p.usn, p.department_id, p.program, p.current_semester, p.section, p.admission_year, p.expected_graduation_year, p.career_goals, (p.skills ?? []).length || null, (p.interests ?? []).length || null, academicsCount || null, p.avatar_path];
  return Math.round((fields.filter((f) => f != null && f !== "").length / fields.length) * 100);
}
