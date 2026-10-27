"use client";

import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";
import { Toaster as Sonner } from "sonner";

const tile = (cls: string, Icon: typeof Info) => (
  <span className={`flex size-8 items-center justify-center rounded-[10px] border border-line bg-surface ${cls}`}>
    <Icon className="size-4" strokeWidth={2} />
  </span>
);

/** White-card toasts with a coloured icon tile; top-centre so they never collide with the dock. */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={72}
      icons={{
        success: tile("text-pine-600", CheckCircle2),
        error: tile("text-coral-700", XCircle),
        warning: tile("text-butter-800", TriangleAlert),
        info: tile("text-sky-700", Info),
      }}
      toastOptions={{
        classNames: {
          toast: "!rounded-card !border !border-line !bg-surface !shadow-dock !font-sans !text-ink-900 !gap-3 !p-3.5",
          title: "!font-semibold !text-body",
          description: "!text-small !text-ink-500",
          actionButton: "!bg-pine-600 !text-white !rounded-control !font-semibold !min-h-8",
        },
      }}
    />
  );
}
