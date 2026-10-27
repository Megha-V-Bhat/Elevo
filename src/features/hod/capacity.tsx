"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { setMentorCapacity } from "@/server/admin/actions";

export function CapacityEditor({ mentorId, capacity }: { mentorId: string; capacity: number }) {
  const router = useRouter();
  const [v, setV] = useState(String(capacity));
  const [pending, start] = useTransition();
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setMentorCapacity(mentorId, Number(v));
          if (!r.ok) return void toast.error(r.error.message);
          toast.success("Capacity updated");
          router.refresh();
        });
      }}
    >
      <label className="grid gap-1.5 text-small font-semibold text-ink-900">
        Capacity
        <Input inputMode="numeric" value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ""))} className="w-24" />
      </label>
      <Button type="submit" variant="secondary" loading={pending} disabled={Number(v) === capacity}>
        Save
      </Button>
    </form>
  );
}
