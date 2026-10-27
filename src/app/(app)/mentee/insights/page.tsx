import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/layout";
import { InsightsView } from "@/features/insights/insights-view";
import { requirePage } from "@/server/authz";
import { insightsFrom, loadAcademics, thresholds } from "@/server/queries/academics";

export const metadata: Metadata = { title: "Insights" };

export default async function MenteeInsights({ searchParams }: { searchParams: Promise<{ sem?: string }> }) {
  const me = await requirePage("MENTEE");
  const sem = Number((await searchParams).sem) || null;
  const [a, t] = await Promise.all([loadAcademics(me.id, me.department_id), thresholds(me.department_id)]);
  return (
    <>
      <PageHeader title="Insights" subtitle="How your semesters are trending, where you're strong, and where to focus next." />
      <InsightsView a={a} report={insightsFrom(a, t.insight)} semester={sem} basePath="/mentee/insights" owner="self" />
    </>
  );
}
