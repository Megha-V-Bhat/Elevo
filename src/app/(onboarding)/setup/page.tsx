import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SetupNotice } from "@/components/feedback/setup-notice";
import { hasSupabase } from "@/lib/env";
import { currentUser, HOME } from "@/server/authz";
import { signedUrl } from "@/server/files";
import { subjectCatalog } from "@/server/queries/academics";
import { mentorOf } from "@/server/queries/people";
import { db } from "@/server/supabase";
import { SetupWizard } from "./wizard";

export const metadata: Metadata = { title: "Set up your profile" };

export default async function SetupPage() {
  if (!hasSupabase) return <SetupNotice />;
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.status === "SUSPENDED") redirect("/suspended");
  if (me.onboarding_completed_at) redirect(HOME[me.role]);
  const supabase = await db();
  const table = me.role === "MENTEE" ? "student_profiles" : "mentor_profiles";
  const [{ data: profile }, { data: dept }, { data: sections }, { data: optional }] = await Promise.all([
    supabase.from(table).select("*").eq("user_id", me.id).maybeSingle(),
    me.department_id ? supabase.from("departments").select("name").eq("id", me.department_id).maybeSingle() : Promise.resolve({ data: null }),
    me.department_id ? supabase.from("sections").select("name").eq("department_id", me.department_id).order("name") : Promise.resolve({ data: [] }),
    supabase.from("app_settings").select("value").eq("key", "optional_profile_fields").maybeSingle(),
  ]);
  const catalog = me.role === "MENTEE" ? await subjectCatalog(me.department_id) : [];
  const mentor = me.role === "MENTEE" ? await mentorOf(me.id) : null;
  let mentees: string[] = [];
  if (me.role === "MENTOR") {
    const { data } = await supabase.from("mentor_assignments").select("student_id").eq("mentor_id", me.id).is("ended_at", null);
    const ids = (data ?? []).map((r) => r.student_id);
    if (ids.length) {
      const { data: p } = await supabase.from("student_profiles").select("full_name").in("user_id", ids);
      mentees = (p ?? []).map((x) => x.full_name || "New student");
    }
  }
  const p = (profile ?? {}) as Record<string, unknown>;
  const { draft, avatar_path, ...saved } = p;
  const initial = { ...Object.fromEntries(Object.entries(saved).filter(([, v]) => v != null)), ...((draft as Record<string, unknown>) ?? {}) };
  return (
    <SetupWizard
      role={me.role}
      email={me.email}
      department={dept?.name ?? "Your department"}
      sections={(sections ?? []).map((s) => s.name)}
      optionalFields={(optional?.value as Record<string, boolean>) ?? { dob: false, gender: false, address: false }}
      initial={initial}
      avatarUrl={await signedUrl("avatars", avatar_path as string | null)}
      catalog={catalog.map((s) => ({ id: s.id, code: s.code, name: s.name, semester: s.semester, credits: s.credits, mse_max: s.mse_max, see_max: s.see_max }))}
      mentorName={mentor?.full_name ?? null}
      mentees={mentees}
    />
  );
}
