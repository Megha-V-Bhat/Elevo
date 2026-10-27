import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/display";
import { KeyValue, PageHeader } from "@/components/ui/layout";
import { PasswordForm, PrefsForm, SessionsCard } from "@/features/account/account-forms";
import { StaffProfileForm } from "@/features/profile/profile-forms";
import { requirePage } from "@/server/authz";
import { signedUrl } from "@/server/files";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Account" };

export default async function Account() {
  const me = await requirePage();
  const supabase = await db();
  const [{ data: u }, { data: staff }] = await Promise.all([
    supabase.from("users").select("notification_prefs, created_at").eq("id", me.id).single(),
    me.role !== "MENTEE" ? supabase.from("mentor_profiles").select("full_name, phone, designation, official_email, faculty_id, expertise, avatar_path").eq("user_id", me.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <>
      <PageHeader title="Account" subtitle="Your sign-in, notifications and sessions." />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          <Card>
            <h2 className="mb-4 font-display text-h3 font-semibold text-ink-900">Sign-in</h2>
            <KeyValue items={[{ k: "Email", v: me.email }, { k: "Role", v: me.role === "MENTEE" ? "Student" : me.role === "MENTOR" ? "Mentor" : "HOD" }]} />
            <p className="mt-4 text-small text-ink-500">Roles are assigned by your HOD. {me.role === "MENTEE" && <Link href="/mentee/profile" className="font-semibold text-pine-600 hover:underline">Edit your profile →</Link>}</p>
          </Card>
          {staff && <StaffProfileForm role={me.role as "MENTOR" | "HOD"} initial={staff} avatarUrl={await signedUrl("avatars", staff.avatar_path)} />}
          <PasswordForm />
        </div>
        <div className="grid content-start gap-5">
          <PrefsForm role={me.role} initial={(u?.notification_prefs as Record<string, boolean>) ?? {}} />
          <SessionsCard />
        </div>
      </div>
    </>
  );
}
