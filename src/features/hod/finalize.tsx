"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { finalizeSemester, verifySemesters } from "@/server/actions/verification";

export function FinalizeButton({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (status === "SUBMITTED")
    return (
      <Button
        size="sm"
        variant="tonal"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await verifySemesters([id]);
            if (!r.ok) return void toast.error(r.error.message);
            toast.success("Verified");
            router.refresh();
          })
        }
      >
        Verify
      </Button>
    );
  if (status !== "VERIFIED") return null;
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={() =>
        toast("Finalize this semester?", {
          description: "Finalized records can only change through an approved correction.",
          action: {
            label: "Finalize",
            onClick: () =>
              start(async () => {
                const r = await finalizeSemester(id);
                if (!r.ok) return void toast.error(r.error.message);
                toast.success("Finalized");
                router.refresh();
              }),
          },
        })
      }
    >
      <Lock /> Finalize
    </Button>
  );
}
