"use client";

import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markSeen } from "@/server/actions/mentoring";

export function MarkAllSeen({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await markSeen("learning_resources", ids);
          if (!r.ok) return void toast.error(r.error.message);
          toast.success("All marked as seen");
          router.refresh();
        })
      }
    >
      <CheckCheck /> Mark all as seen
    </Button>
  );
}
