import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/layout";
import { loadJourney, SteppingStones } from "@/features/journey/journey";
import { requirePage } from "@/server/authz";

export const metadata: Metadata = { title: "Journey" };

export default async function MenteeJourney({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const me = await requirePage("MENTEE");
  const events = await loadJourney(me.id, me.department_id, "mentee");
  return (
    <>
      <PageHeader title="Your journey" subtitle="Every verified semester, goal, session and resolved question, newest first." />
      <SteppingStones events={events} active={(await searchParams).type || null} basePath="/mentee/journey" />
    </>
  );
}
