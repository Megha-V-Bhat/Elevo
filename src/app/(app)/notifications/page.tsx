import type { Metadata } from "next";
import { Card } from "@/components/ui/display";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { NotificationCenter } from "@/features/account/notification-center";
import { requirePage } from "@/server/authz";
import type { NotificationRow } from "@/server/actions/shell";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Notifications" };

export default async function Notifications({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requirePage();
  const filter = (await searchParams).filter ?? "all";
  const supabase = await db();
  let q = supabase.from("notifications").select("id, type, title, body, link, read_at, snoozed_until, created_at").order("created_at", { ascending: false }).limit(100);
  if (filter === "unread") q = q.is("read_at", null);
  const { data } = await q;
  const rows = (data ?? []) as NotificationRow[];
  return (
    <>
      <PageHeader title="Notifications" subtitle="Feedback, replies, reminders and changes — grouped by when they arrived." />
      {rows.length ? (
        <NotificationCenter rows={rows} filter={filter} />
      ) : (
        <Card>
          <EmptyState illustration="notifications" title={filter === "unread" ? "No unread notifications" : "You're all caught up"} body="New feedback, replies and reminders will appear here." />
        </Card>
      )}
    </>
  );
}
