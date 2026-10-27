import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./supabase";
import { AppError } from "./result";

export type Role = "MENTEE" | "MENTOR" | "HOD";

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
  department_id: string | null;
  onboarding_completed_at: string | null;
  name: string;
  avatar_path: string | null;
};

export const HOME: Record<Role, string> = { MENTEE: "/mentee", MENTOR: "/mentor", HOD: "/hod" };

/**
 * The signed-in user with role + status read from the database — never from
 * cookies, URL, localStorage or user_metadata. Cached per request.
 */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await db();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: u } = await supabase
    .from("users")
    .select("id, email, role, status, department_id, onboarding_completed_at")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!u) return null;
  const table = u.role === "MENTEE" ? "student_profiles" : "mentor_profiles";
  const { data: p } = await supabase.from(table).select("full_name, avatar_path").eq("user_id", u.id).maybeSingle();
  return {
    ...(u as Omit<SessionUser, "name" | "avatar_path">),
    name: p?.full_name || u.email.split("@")[0],
    avatar_path: p?.avatar_path ?? null,
  };
});

/** For pages/layouts: redirect when not allowed. */
export async function requirePage(...roles: Role[]): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (u.status === "SUSPENDED") redirect("/suspended");
  if (!u.onboarding_completed_at) redirect("/setup");
  if (roles.length && !roles.includes(u.role)) redirect(HOME[u.role]);
  return u;
}

/** For actions/handlers: throw (mapped by handle()). */
export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new AppError("UNAUTHENTICATED", "Please sign in again.");
  if (u.status === "SUSPENDED") throw new AppError("FORBIDDEN", "This account is suspended.");
  return u;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new AppError("FORBIDDEN", "You don't have permission to do that.");
  return u;
}

export async function isActiveMentorOf(mentorId: string, studentId: string) {
  const supabase = await db();
  const { data } = await supabase
    .from("mentor_assignments")
    .select("id")
    .eq("mentor_id", mentorId)
    .eq("student_id", studentId)
    .is("ended_at", null)
    .maybeSingle();
  return Boolean(data);
}

/** Student themself, their CURRENT mentor, or the HOD. */
export async function assertCanViewStudent(studentId: string): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role === "HOD" || u.id === studentId) return u;
  if (u.role === "MENTOR" && (await isActiveMentorOf(u.id, studentId))) return u;
  throw new AppError("FORBIDDEN", "You can only view students assigned to you.");
}

export async function assertCanEditMentoring(studentId: string): Promise<SessionUser> {
  const u = await requireRole("MENTOR");
  if (!(await isActiveMentorOf(u.id, studentId))) throw new AppError("FORBIDDEN", "This student isn't assigned to you.");
  return u;
}

export async function assertCanViewThread(threadId: string): Promise<{ user: SessionUser; studentId: string }> {
  const u = await requireRole("MENTEE", "MENTOR");
  const supabase = await db();
  const { data } = await supabase.from("ask_threads").select("student_id").eq("id", threadId).maybeSingle();
  if (!data) throw new AppError("NOT_FOUND", "We couldn't find that question.");
  return { user: u, studentId: data.student_id };
}
