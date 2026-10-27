import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { AuditDiff } from "@/features/hod/history";
import { fmtDateTime } from "@/lib/dates";
import { requirePage } from "@/server/authz";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Audit history" };

const ENTITIES = ["academic_semesters", "student_subject_results", "semester_summaries", "mentor_assignments", "users", "mentor_recommendations", "grading_schemes", "app_settings", "ask_messages", "record_change_requests"];

export default async function Audit({ searchParams }: { searchParams: Promise<{ entity?: string; action?: string; actor?: string; from?: string; to?: string; page?: string }> }) {
  await requirePage("HOD");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await db();
  let actorIds: string[] | null = null;
  if (sp.actor) {
    const like = `%${sp.actor.replace(/[%_,()]/g, " ")}%`;
    const [{ data: a }, { data: b }] = await Promise.all([supabase.from("mentor_profiles").select("user_id").ilike("full_name", like), supabase.from("users").select("id").ilike("email", like)]);
    actorIds = [...(a ?? []).map((x) => x.user_id), ...(b ?? []).map((x) => x.id)];
  }
  let q = supabase.from("audit_logs").select("id, actor_id, action, entity_type, entity_id, before, after, created_at", { count: "exact" }).order("created_at", { ascending: false });
  if (sp.entity) q = q.eq("entity_type", sp.entity);
  if (sp.action) q = q.eq("action", sp.action);
  if (sp.from) q = q.gte("created_at", sp.from);
  if (sp.to) q = q.lte("created_at", `${sp.to}T23:59:59`);
  if (actorIds) q = q.in("actor_id", actorIds.length ? actorIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data, count } = await q.range((page - 1) * 25, page * 25 - 1);
  const actors = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const [{ data: u }, { data: sp1 }, { data: mp }] = await Promise.all([
    actors.length ? supabase.from("users").select("id, email").in("id", actors) : Promise.resolve({ data: [] }),
    actors.length ? supabase.from("student_profiles").select("user_id, full_name").in("user_id", actors) : Promise.resolve({ data: [] }),
    actors.length ? supabase.from("mentor_profiles").select("user_id, full_name").in("user_id", actors) : Promise.resolve({ data: [] }),
  ]);
  const names = new Map<string, string>([...(u ?? []).map((x) => [x.id, x.email] as [string, string]), ...[...(sp1 ?? []), ...(mp ?? [])].filter((p) => p.full_name).map((p) => [p.user_id, p.full_name] as [string, string])]);
  const pages = Math.max(1, Math.ceil((count ?? 0) / 25));
  const qs = (p: number) => `/hod/audit?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), page: String(p) } as Record<string, string>)}`;
  return (
    <>
      <PageHeader title="Audit history" subtitle="Every change to marks, records, assignments, roles, mentoring items and settings — who, what, before and after." />
      <form role="search" className="mb-5 grid gap-3 rounded-card border border-line bg-surface p-3 shadow-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto_auto]">
        <label className="relative">
          <span className="sr-only">Actor name or email</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
          <Input name="actor" defaultValue={sp.actor} placeholder="Actor name or email" className="pl-9" />
        </label>
        <Select name="entity" defaultValue={sp.entity ?? ""} aria-label="Entity">
          <option value="">Any entity</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        <Select name="action" defaultValue={sp.action ?? ""} aria-label="Action">
          <option value="">Any action</option>
          <option value="insert">Created</option>
          <option value="update">Updated</option>
          <option value="delete">Deleted</option>
        </Select>
        <Input type="date" name="from" defaultValue={sp.from} aria-label="From date" />
        <Input type="date" name="to" defaultValue={sp.to} aria-label="To date" />
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>
      {data?.length ? (
        <ol className="grid gap-3">
          {data.map((r) => (
            <li key={r.id}>
              <details className="group rounded-card border border-line bg-surface p-4 shadow-1">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
                  <span className={`rounded-full px-2.5 py-0.5 text-label font-semibold ${r.action === "insert" ? "bg-mint-100 text-pine-700" : r.action === "delete" ? "bg-coral-100 text-coral-700" : "bg-sky-100 text-sky-700"}`}>{r.action}</span>
                  <span className="font-semibold text-ink-900">{r.entity_type.replace(/_/g, " ")}</span>
                  <span className="text-small text-ink-700">by {r.actor_id ? (names.get(r.actor_id) ?? "Unknown") : "System"}</span>
                  <span className="ml-auto text-small text-ink-500">{fmtDateTime(r.created_at)}</span>
                </summary>
                <div className="mt-3 border-t border-line pt-3">
                  <AuditDiff before={r.before as Record<string, unknown> | null} after={r.after as Record<string, unknown> | null} />
                </div>
              </details>
            </li>
          ))}
        </ol>
      ) : (
        <Card>
          <EmptyState illustration="search" title="No history matches" />
        </Card>
      )}
      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-5 flex items-center justify-between">
          <span className="text-small text-ink-500">
            Page {page} of {pages}
          </span>
          <div className="flex gap-4">
            {page > 1 && <Link href={qs(page - 1)} className="font-semibold text-pine-600 hover:underline">← Newer</Link>}
            {page < pages && <Link href={qs(page + 1)} className="font-semibold text-pine-600 hover:underline">Older →</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
