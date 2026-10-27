"use client";

import { CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { NotificationList } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { markNotifications, type NotificationRow } from "@/server/actions/shell";

export function NotificationCenter({ rows, filter }: { rows: NotificationRow[]; filter: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { k: "all", l: "All" },
          { k: "unread", l: "Unread" },
        ].map((f) => (
          <Link key={f.k} href={`/notifications${f.k === "all" ? "" : `?filter=${f.k}`}`} aria-current={filter === f.k ? "true" : undefined} className="inline-flex min-h-9 items-center rounded-full border border-line px-3.5 text-small font-semibold text-ink-700 aria-[current=true]:border-pine-600 aria-[current=true]:bg-pine-600 aria-[current=true]:text-white">
            {f.l}
          </Link>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          loading={pending}
          onClick={() =>
            start(async () => {
              await markNotifications("all");
              router.refresh();
            })
          }
        >
          <CheckCheck /> Mark all read
        </Button>
      </div>
      <NotificationList rows={rows} onAction={() => router.refresh()} />
    </Card>
  );
}
