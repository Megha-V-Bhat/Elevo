"use client";

import { Bookmark, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { deleteView, saveView } from "@/server/admin/actions";

export function SavedViews({ scope, base, views, current }: { scope: string; base: string; views: { id: string; name: string; filters: Record<string, string> }[]; current: Record<string, string> }) {
  const router = useRouter();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const active = Object.keys(current).length > 0;
  return (
    <div className="-mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
      {views.map((v) => (
        <span key={v.id} className="inline-flex shrink-0 items-center rounded-full border border-line bg-surface pl-3.5 text-small font-semibold text-ink-700">
          <Link href={`${base}?${new URLSearchParams(v.filters)}`} className="py-2 hover:text-pine-700">
            {v.name}
          </Link>
          <button
            type="button"
            aria-label={`Delete view ${v.name}`}
            onClick={() =>
              start(async () => {
                const r = await deleteView(v.id);
                if (!r.ok) return void toast.error(r.error.message);
                router.refresh();
              })
            }
            className="flex size-9 items-center justify-center rounded-full text-ink-500 hover:text-coral-700"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      {active &&
        (naming ? (
          <form
            className="flex shrink-0 items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await saveView(scope, name, current);
                if (!r.ok) return void toast.error(r.error.message);
                toast.success("View saved");
                setNaming(false);
                setName("");
                router.refresh();
              });
            }}
          >
            <Input aria-label="View name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sem 5 · Section A" className="h-9 w-48" />
            <Button size="sm" type="submit" loading={pending} disabled={!name.trim()}>
              Save
            </Button>
          </form>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setNaming(true)} className="shrink-0">
            <Bookmark /> Save this view
          </Button>
        ))}
    </div>
  );
}
