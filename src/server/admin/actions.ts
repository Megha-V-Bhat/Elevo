"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SITE_URL } from "@/lib/env";
import { inviteInput, schemeInput } from "@/lib/validators";
import { requireRole } from "../authz";
import { AppError, handle, must } from "../result";
import { db } from "../supabase";
import { adminDb } from "./client";
import { createInvitedUser } from "./users";

const uuid = z.string().uuid();

/** Invite a user: HOD check first, then the service role creates the auth user and the Elevo row. */
export async function inviteUser(input: unknown) {
  return handle(async () => {
    const hod = await requireRole("HOD");
    const v = inviteInput.parse(input);
    return createInvitedUser(hod.department_id, v.email, v.role, v.full_name, true);
  });
}

export async function resendInvite(userId: string) {
  return handle(async () => {
    await requireRole("HOD");
    const supabase = await db();
    const { data: u } = await supabase.from("users").select("email, status").eq("id", uuid.parse(userId)).maybeSingle();
    if (!u) throw new AppError("NOT_FOUND", "User not found.");
    if (u.status !== "INVITED") throw new AppError("CONFLICT", "This person has already activated their account.");
    const { error } = await adminDb().auth.resetPasswordForEmail(u.email, { redirectTo: `${SITE_URL}/auth/confirm?next=/accept-invite` });
    if (error) throw new AppError("INTERNAL", "We couldn't resend the invite. Try again in a minute.");
    return true;
  });
}

/** Role and status changes run as the HOD (RLS + guard trigger enforce and audit them). */
export async function setUserRole(userId: string, role: "MENTEE" | "MENTOR" | "HOD") {
  return handle(async () => {
    await requireRole("HOD");
    const supabase = await db();
    const id = uuid.parse(userId);
    must(await supabase.from("users").update({ role: z.enum(["MENTEE", "MENTOR", "HOD"]).parse(role) }).eq("id", id));
    const table = role === "MENTEE" ? "student_profiles" : "mentor_profiles";
    const { data: exists } = await supabase.from(table).select("user_id").eq("user_id", id).maybeSingle();
    if (!exists) {
      const { data: other } = await supabase.from(role === "MENTEE" ? "mentor_profiles" : "student_profiles").select("full_name").eq("user_id", id).maybeSingle();
      must(await supabase.from(table).insert({ user_id: id, full_name: other?.full_name ?? "" }));
    }
    revalidatePath("/hod", "layout");
    return true;
  });
}

export async function setUserStatus(userId: string, status: "ACTIVE" | "SUSPENDED") {
  return handle(async () => {
    await requireRole("HOD");
    const supabase = await db();
    must(await supabase.from("users").update({ status: z.enum(["ACTIVE", "SUSPENDED"]).parse(status) }).eq("id", uuid.parse(userId)));
    revalidatePath("/hod", "layout");
    return true;
  });
}

export async function setMentorCapacity(mentorId: string, capacity: number) {
  return handle(async () => {
    await requireRole("HOD");
    const supabase = await db();
    must(await supabase.from("mentor_profiles").update({ capacity: z.number().int().min(1).max(200).parse(capacity) }).eq("user_id", uuid.parse(mentorId)));
    revalidatePath("/hod", "layout");
    return true;
  });
}

// ───────────── Assignments ─────────────
export type Moved = { student_id: string; previous_mentor_id: string | null };

export async function assignStudents(studentIds: string[], mentorId: string, reason?: string) {
  return handle(async () => {
    await requireRole("HOD");
    const supabase = await db();
    const { data, error } = await supabase.rpc("assign_students", {
      p_student_ids: z.array(uuid).min(1).max(500).parse(studentIds),
      p_mentor_id: uuid.parse(mentorId),
      p_reason: reason ? z.string().max(300).parse(reason) : null,
    });
    if (error) throw new AppError(error.code === "42501" ? "FORBIDDEN" : "CONFLICT", error.message);
    revalidatePath("/hod", "layout");
    return data as Moved[];
  });
}

/** Undo puts every moved student back with their previous mentor (or back in the unassigned pool). */
export async function undoAssignment(moved: Moved[]) {
  return handle(async () => {
    await requireRole("HOD");
    const supabase = await db();
    const groups = new Map<string | null, string[]>();
    for (const m of z.array(z.object({ student_id: uuid, previous_mentor_id: uuid.nullable() })).max(500).parse(moved)) groups.set(m.previous_mentor_id, [...(groups.get(m.previous_mentor_id) ?? []), m.student_id]);
    for (const [mentor, students] of groups) {
      if (mentor) must(await supabase.rpc("assign_students", { p_student_ids: students, p_mentor_id: mentor, p_reason: "Undo" }));
      else must(await supabase.rpc("unassign_students", { p_student_ids: students, p_reason: "Undo" }));
    }
    revalidatePath("/hod", "layout");
    return true;
  });
}

export async function unassignStudents(studentIds: string[], reason?: string) {
  return handle(async () => {
    await requireRole("HOD");
    const supabase = await db();
    const { data } = await supabase.from("mentor_assignments").select("student_id, mentor_id").in("student_id", z.array(uuid).parse(studentIds)).is("ended_at", null);
    must(await supabase.rpc("unassign_students", { p_student_ids: studentIds, p_reason: reason ?? null }));
    revalidatePath("/hod", "layout");
    return (data ?? []).map((d) => ({ student_id: d.student_id, previous_mentor_id: d.mentor_id })) as Moved[];
  });
}

// ───────────── Settings ─────────────
export async function saveGradingScheme(input: unknown, activate: boolean) {
  return handle(async () => {
    const hod = await requireRole("HOD");
    const v = schemeInput.parse(input);
    const supabase = await db();
    const { data: last } = await supabase.from("grading_schemes").select("version").eq("department_id", hod.department_id).order("version", { ascending: false }).limit(1).maybeSingle();
    if (activate) must(await supabase.from("grading_schemes").update({ active: false }).eq("department_id", hod.department_id).eq("active", true));
    must(
      await supabase.from("grading_schemes").insert({ ...v, department_id: hod.department_id, version: (last?.version ?? 0) + 1, active: activate, created_by: hod.id }),
    );
    revalidatePath("/", "layout");
    return (last?.version ?? 0) + 1;
  });
}

export async function saveThresholds(values: Record<string, number>) {
  return handle(async () => {
    const hod = await requireRole("HOD");
    const v = z
      .object({
        strong_pct: z.number().min(50).max(100),
        decline_pts: z.number().min(1).max(50),
        sgpa_change: z.number().min(0.1).max(3),
        needs_attention_pct: z.number().min(10).max(80),
        low_pct: z.number().min(10).max(80),
        low_count: z.number().int().min(1).max(10),
        profile_incomplete_days: z.number().int().min(1).max(120),
      })
      .parse(values);
    if (!hod.department_id) throw new AppError("VALIDATION", "Your account has no department.");
    const supabase = await db();
    must(await supabase.from("risk_thresholds").upsert(Object.entries(v).map(([rule_key, val]) => ({ department_id: hod.department_id, rule_key, value: { v: val } }))));
    revalidatePath("/", "layout");
    return true;
  });
}

export async function saveSetting(key: "program_total_credits" | "pulse_week_start" | "optional_profile_fields" | "institution" | "pulse_reminder_enabled", value: unknown) {
  return handle(async () => {
    await requireRole("HOD");
    const schemas = {
      program_total_credits: z.number().int().min(20).max(400),
      pulse_week_start: z.number().int().min(0).max(6),
      optional_profile_fields: z.object({ dob: z.boolean(), gender: z.boolean(), address: z.boolean() }),
      institution: z.string().trim().min(2).max(120),
      pulse_reminder_enabled: z.boolean(),
    };
    const v = schemas[key].parse(value);
    const supabase = await db();
    must(await supabase.from("app_settings").upsert({ key, value: v, updated_at: new Date().toISOString() }));
    revalidatePath("/", "layout");
    return true;
  });
}

export async function saveSections(names: string[]) {
  return handle(async () => {
    const hod = await requireRole("HOD");
    const list = z.array(z.string().trim().toUpperCase().min(1).max(10)).max(30).parse(names);
    const supabase = await db();
    const { data: existing } = await supabase.from("sections").select("id, name").eq("department_id", hod.department_id);
    const keep = new Set(list);
    const remove = (existing ?? []).filter((s) => !keep.has(s.name)).map((s) => s.id);
    if (remove.length) must(await supabase.from("sections").delete().in("id", remove));
    const add = list.filter((n) => !(existing ?? []).some((s) => s.name === n));
    if (add.length) must(await supabase.from("sections").insert(add.map((name) => ({ name, department_id: hod.department_id }))));
    revalidatePath("/hod/settings");
    return true;
  });
}

export async function saveDepartment(name: string, institution: string) {
  return handle(async () => {
    const hod = await requireRole("HOD");
    const supabase = await db();
    must(await supabase.from("departments").update({ name: z.string().trim().min(2).max(120).parse(name), institution: z.string().trim().min(2).max(160).parse(institution) }).eq("id", hod.department_id));
    revalidatePath("/", "layout");
    return true;
  });
}

export async function saveView(scope: string, name: string, filters: Record<string, string>) {
  return handle(async () => {
    const u = await requireRole("HOD", "MENTOR");
    const supabase = await db();
    must(await supabase.from("saved_views").upsert({ user_id: u.id, scope: z.string().max(40).parse(scope), name: z.string().trim().min(1).max(60).parse(name), filters: z.record(z.string(), z.string()).parse(filters) }, { onConflict: "user_id,scope,name" }));
    revalidatePath("/hod", "layout");
    return true;
  });
}

export async function deleteView(id: string) {
  return handle(async () => {
    await requireRole("HOD", "MENTOR");
    const supabase = await db();
    must(await supabase.from("saved_views").delete().eq("id", uuid.parse(id)));
    revalidatePath("/hod", "layout");
    return true;
  });
}

/** Bulk "please follow up" notification to mentors of flagged students (system-written after the HOD check). */
export async function notifyMentors(groups: { mentor_id: string; names: string[] }[]) {
  return handle(async () => {
    await requireRole("HOD");
    const v = z.array(z.object({ mentor_id: uuid, names: z.array(z.string().max(120)).max(200) })).max(200).parse(groups);
    must(
      await adminDb()
        .from("notifications")
        .insert(
          v.map((g) => ({
            user_id: g.mentor_id,
            type: "intervention",
            title: `Follow-up requested for ${g.names.length} mentee${g.names.length > 1 ? "s" : ""}`,
            body: g.names.slice(0, 5).join(", ") + (g.names.length > 5 ? ` and ${g.names.length - 5} more` : ""),
            link: "/mentor#attention",
          })),
        ),
    );
    return v.length;
  });
}
