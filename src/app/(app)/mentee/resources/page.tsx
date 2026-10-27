import type { Metadata } from "next";
import { Card } from "@/components/ui/display";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { ResourceCard } from "@/features/mentoring/resource-card";
import { MarkAllSeen } from "@/features/mentoring/mark-all-seen";
import { requirePage } from "@/server/authz";
import { resources } from "@/server/queries/mentoring";

export const metadata: Metadata = { title: "Resources" };

export default async function MenteeResources({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const me = await requirePage("MENTEE");
  const sp = await searchParams;
  const all = await resources({ viewerId: me.id });
  const subjects = [...new Map(all.filter((r) => r.subject).map((r) => [r.subject!.id, r.subject!])).values()];
  const list = sp.subject ? all.filter((r) => r.subject?.id === sp.subject) : all;
  const unseen = all.filter((r) => !r.seen).map((r) => r.id);
  return (
    <>
      <PageHeader title="Resources" subtitle="Notes, slides and links your mentor shared, with instructions on how to use them." action={unseen.length ? <MarkAllSeen ids={unseen} /> : undefined} />
      {subjects.length > 0 && (
        <nav aria-label="Filter by subject" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {[{ id: "", code: "All subjects" }, ...subjects].map((s) => (
            <a
              key={s.id}
              href={s.id ? `/mentee/resources?subject=${s.id}` : "/mentee/resources"}
              aria-current={(sp.subject ?? "") === s.id ? "true" : undefined}
              className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-small font-semibold text-ink-700 aria-[current=true]:border-pine-600 aria-[current=true]:bg-pine-600 aria-[current=true]:text-white"
            >
              {s.code}
            </a>
          ))}
        </nav>
      )}
      {list.length === 0 ? (
        <Card>
          <EmptyState illustration="resources" title="No resources yet" body="When your mentor shares study material it appears here, marked New until you've seen it." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <ResourceCard key={r.id} r={r} isNew={!r.seen} />
          ))}
        </div>
      )}
    </>
  );
}
