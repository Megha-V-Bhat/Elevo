import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/layout";
import { TabStrip } from "@/components/ui/tabs";
import { GradingEditor, ProfileFieldsForm, PulseForm, StructureForm, ThresholdsForm } from "@/features/hod/settings-forms";
import { requirePage } from "@/server/authz";
import { activeScheme, thresholds } from "@/server/queries/academics";
import { sectionsList } from "@/server/queries/hod";
import { appSettings } from "@/server/queries/settings";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { key: "grading", label: "Grading" },
  { key: "thresholds", label: "Thresholds" },
  { key: "structure", label: "Structure" },
  { key: "fields", label: "Profile fields" },
  { key: "pulse", label: "Pulse" },
];

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requirePage("HOD");
  const tab = (await searchParams).tab ?? "grading";
  const supabase = await db();
  const [scheme, t, settings, sections, { data: dept }, { data: ver }, { data: rem }] = await Promise.all([
    activeScheme(me.department_id),
    thresholds(me.department_id),
    appSettings(),
    sectionsList(),
    supabase.from("departments").select("name, institution").eq("id", me.department_id).maybeSingle(),
    supabase.from("grading_schemes").select("version").eq("department_id", me.department_id).eq("active", true).maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "pulse_reminder_enabled").maybeSingle(),
  ]);
  return (
    <>
      <PageHeader title="Settings" subtitle="Grading, thresholds, structure and privacy-respecting defaults for your department. Every change is audited." />
      <TabStrip label="Settings sections" active={tab} tabs={TABS.map((x) => ({ ...x, href: `/hod/settings?tab=${x.key}` }))} />
      <div className="grid gap-5">
        {tab === "grading" && <GradingEditor scheme={scheme} version={ver?.version ?? null} />}
        {tab === "thresholds" && <ThresholdsForm initial={{ ...t.insight, ...t.risk }} />}
        {tab === "structure" && <StructureForm department={dept?.name ?? ""} institution={dept?.institution ?? settings.institution} sections={sections} totalCredits={settings.program_total_credits} />}
        {tab === "fields" && <ProfileFieldsForm initial={settings.optional_profile_fields} />}
        {tab === "pulse" && <PulseForm weekStart={settings.pulse_week_start} reminders={rem?.value !== false} />}
      </div>
    </>
  );
}
