"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markPulseSeen } from "@/server/actions/pulse";

export function PulseSeenButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="tonal"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await markPulseSeen(id);
          if (!r.ok) return void toast.error(r.error.message);
          router.refresh();
        })
      }
    >
      <Check /> Mark seen
    </Button>
  );
}
