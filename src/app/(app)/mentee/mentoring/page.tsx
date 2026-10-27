import type { Metadata } from "next";
import { Card } from "@/components/ui/display";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { TabStrip } from "@/components/ui/tabs";
import { RecItem } from "@/features/mentoring/rec-item";
import { SeenMarker } from "@/features/mentoring/seen-marker";
import { requirePage } from "@/server/authz";
import { recommendations } from "@/server/queries/mentoring";

export const metadata: Metadata = { title: "Mentoring" };

const TABS = {
  feedback: { label: "Feedback & recommendations", kinds: ["FEEDBACK", "RECOMMENDATION"] },
  plan: { label: "Goals & improvement plan", kinds: ["GOAL", "ACTION_POINT"] },
  strengths: { label: "Strengths & areas", kinds: ["STRENGTH", "IMPROVEMENT_AREA"] },
} as const;

export default async function MenteeMentoring({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string }> }) {
  const me = await requirePage("MENTEE");
  const sp = await searchParams;
  const tab = (sp.tab && sp.tab in TABS ? sp.tab : "feedback") as keyof typeof TABS;
  const all = await recommendations({ studentId: me.id, viewerId: me.id });
  const items = all.filter((r) => (TABS[tab].kinds as readonly string[]).includes(r.kind)).filter((r) => !sp.status || r.status === sp.status);
  const unseen = all.filter((r) => !r.seen).map((r) => r.id);
  return (
    <>
      <PageHeader title="Mentoring" subtitle="Everything your mentor has shared with you: guidance, goals and the steps you've agreed on." />
      <TabStrip
        label="Mentoring sections"
        active={tab}
        tabs={Object.entries(TABS).map(([k, t]) => ({ key: k, label: t.label, href: `/mentee/mentoring?tab=${k}`, count: all.filter((r) => (t.kinds as readonly string[]).includes(r.kind) && r.status !== "COMPLETED").length }))}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { k: "", l: "All" },
          { k: "PENDING", l: "Pending" },
          { k: "IN_PROGRESS", l: "In progress" },
          { k: "COMPLETED", l: "Completed" },
        ].map((f) => (
          <a
            key={f.k}
            href={`/mentee/mentoring?tab=${tab}${f.k ? `&status=${f.k}` : ""}`}
            aria-current={(sp.status ?? "") === f.k ? "true" : undefined}
            className="inline-flex min-h-9 items-center rounded-full border border-line bg-surface px-3.5 text-small font-semibold text-ink-700 aria-[current=true]:border-pine-600 aria-[current=true]:bg-pine-50 aria-[current=true]:text-pine-700"
          >
            {f.l}
          </a>
        ))}
      </div>
      {items.length === 0 ? (
        <Card>
          <EmptyState
            illustration={tab === "plan" ? "plans" : "feedback"}
            title={tab === "plan" ? "No goals yet" : tab === "strengths" ? "Nothing noted yet" : "No feedback yet"}
            body="When your mentor shares something, it appears here and you'll get a notification."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((r) => (
            <RecItem key={r.id} r={r} viewer="MENTEE" isNew={!r.seen} />
          ))}
        </div>
      )}
      <SeenMarker type="mentor_recommendations" ids={unseen} />
    </>
  );
}
