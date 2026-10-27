import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/display";
import { KeyValue, PageHeader } from "@/components/ui/layout";
import { IdentityColumn, MentorCardView } from "@/features/profile/identity";
import { AboutForm, PersonalForm } from "@/features/profile/profile-forms";
import { requirePage } from "@/server/authz";
import { mentorOf, studentProfile } from "@/server/queries/people";
import { appSettings } from "@/server/queries/settings";

export const metadata: Metadata = { title: "My profile" };

export default async function MenteeProfile() {
  const me = await requirePage("MENTEE");
  const [p, mentor, settings] = await Promise.all([studentProfile(me.id), mentorOf(me.id), appSettings()]);
  if (!p) notFound();
  return (
    <>
      <PageHeader title="My profile" subtitle="Keep your details current so your mentor can support you well." />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="grid content-start gap-5">
          <IdentityColumn p={p} mentorName={mentor?.full_name ?? null} />
          <MentorCardView m={mentor} />
        </div>
        <div className="grid content-start gap-5">
          <PersonalForm initial={{ full_name: p.full_name, phone: p.phone, dob: p.dob, gender: p.gender, address: p.address }} avatarUrl={p.avatar_url} optional={settings.optional_profile_fields} />
          <Card>
            <h2 className="mb-1 font-display text-h3 font-semibold text-ink-900">Academic identity</h2>
            <p className="mb-4 text-small text-ink-500">Locked after setup. Ask your HOD to correct anything here.</p>
            <KeyValue
              items={[
                { k: "USN", v: p.usn },
                { k: "Program", v: p.program },
                { k: "Current semester", v: p.current_semester },
                { k: "Section", v: p.section },
                { k: "Admission year", v: p.admission_year },
                { k: "Expected graduation", v: p.expected_graduation_year },
              ]}
            />
          </Card>
          <AboutForm initial={{ skills: p.skills, interests: p.interests, career_goals: p.career_goals, achievements: p.achievements, support_areas: p.support_areas }} />
        </div>
      </div>
    </>
  );
}
