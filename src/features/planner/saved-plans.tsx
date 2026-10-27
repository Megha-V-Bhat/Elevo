"use client";

import { Share2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/display";
import { fmtDate } from "@/lib/dates";
import { deletePlan, sharePlan } from "@/server/actions/plans";

export type SavedPlan = { id: string; kind: string; title: string; result: Record<string, unknown>; shared_with_mentor: boolean; created_at: string };

export function SavedPlans({ plans }: { plans: SavedPlan[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ul className="grid gap-2">
      {plans.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-panel border border-line bg-surface p-3.5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink-900">{p.title}</p>
            <p className="text-small text-ink-500">
              {p.kind === "CGPA" ? `Needs ${Number(p.result.required).toFixed(2)} average SGPA` : `Needs ${String(p.result.min_see_marks)}/${String(p.result.see_max)} in SEE`} · {fmtDate(p.created_at)}
            </p>
          </div>
          {p.shared_with_mentor && <Chip tone="lilac">Shared</Chip>}
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await sharePlan(p.id, !p.shared_with_mentor);
                if (!r.ok) return void toast.error(r.error.message);
                toast.success(p.shared_with_mentor ? "No longer shared" : "Shared with your mentor");
                router.refresh();
              })
            }
          >
            <Share2 /> {p.shared_with_mentor ? "Unshare" : "Share"}
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            aria-label={`Delete ${p.title}`}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deletePlan(p.id);
                if (!r.ok) return void toast.error(r.error.message);
                toast.success("Plan deleted");
                router.refresh();
              })
            }
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}
