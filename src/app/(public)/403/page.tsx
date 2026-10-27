import type { Metadata } from "next";
import { SystemPage } from "@/components/feedback/system-page";

export const metadata: Metadata = { title: "No access" };

export default function Forbidden() {
  return <SystemPage art="locked" code="403" title="This isn't yours to see" body="Elevo only shows information you're allowed to access. Mentors see their current mentees; students see their own records." />;
}
