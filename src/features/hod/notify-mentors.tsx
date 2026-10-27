"use client";

import { BellRing } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { notifyMentors } from "@/server/admin/actions";

export function NotifyMentors({ groups }: { groups: { mentor_id: string; names: string[] }[] }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      loading={pending}
      disabled={!groups.length}
      onClick={() =>
        start(async () => {
          const r = await notifyMentors(groups);
          if (!r.ok) return void toast.error(r.error.message);
          toast.success(`Notified ${r.data} mentor${r.data === 1 ? "" : "s"}`);
        })
      }
    >
      <BellRing /> Notify their mentors
    </Button>
  );
}
