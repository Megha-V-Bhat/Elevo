"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteResource } from "@/server/actions/mentoring";

export function DeleteResourceButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      className="ml-auto text-coral-700"
      onClick={() =>
        toast("Delete this resource?", {
          description: "Students will no longer see it.",
          action: {
            label: "Delete",
            onClick: () =>
              start(async () => {
                const r = await deleteResource(id);
                if (!r.ok) return void toast.error(r.error.message);
                toast.success("Resource deleted");
                router.refresh();
              }),
          },
        })
      }
    >
      <Trash2 /> Delete
    </Button>
  );
}
