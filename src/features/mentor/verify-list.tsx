"use client";

import { cn } from "@/lib/utils";
import { BulkVerify, ReturnButton } from "./verify-queue";

export function BulkVerifyList({ items }: { items: { id: string; label: string; header: React.ReactNode; body: React.ReactNode }[] }) {
  return (
    <BulkVerify items={items}>
      {({ selected, toggle }) => (
        <ul className="grid gap-4">
          {items.map((i) => (
            <li key={i.id} className={cn("rounded-card border bg-surface p-4 shadow-1 transition-colors md:p-5", selected.has(i.id) ? "border-pine-600" : "border-line")}>
              <div className="flex items-start gap-3">
                <input type="checkbox" aria-label={`Select ${i.label}`} className="mt-2 size-5 shrink-0 accent-pine-600" checked={selected.has(i.id)} onChange={() => toggle(i.id)} />
                <div className="min-w-0 flex-1">{i.header}</div>
              </div>
              <div className="mt-4">{i.body}</div>
              <div className="mt-3 flex justify-end">
                <ReturnButton semesterId={i.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </BulkVerify>
  );
}
