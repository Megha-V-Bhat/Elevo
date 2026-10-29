import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { InviteButton, type UserRow, UsersTable } from "@/features/hod/users-admin";
import { requirePage } from "@/server/authz";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Users & roles" };

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }> }) {
  const me = await requirePage("HOD");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await db();
  let q = supabase.from("users").select("id, email, role, status, created_at, last_seen_at", { count: "exact" }).order("created_at", { ascending: false });
  if (sp.q) q = q.ilike("email", `%${sp.q.replace(/[%_,()]/g, " ")}%`);
  if (sp.role) q = q.eq("role", sp.role);
  if (sp.status) q = q.eq("status", sp.status);
  const { data, count } = await q.range((page - 1) * 30, page * 30 - 1);
  const ids = (data ?? []).map((u) => u.id);
  const [{ data: sp1 }, { data: mp }] = await Promise.all([
    ids.length ? supabase.from("student_profiles").select("user_id, full_name").in("user_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("mentor_profiles").select("user_id, full_name").in("user_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const names = new Map([...(sp1 ?? []), ...(mp ?? [])].map((p) => [p.user_id, p.full_name]));
  const rows: UserRow[] = (data ?? []).map((u) => ({ ...u, name: names.get(u.id) ?? "" })) as UserRow[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / 30));
  return (
    <>
      <PageHeader
        title="Users & roles"
        subtitle="Invite people, change roles and suspend accounts. Every change is audited; Elevo always keeps at least one active HOD."
        action={
          <Suspense>
            <InviteButton />
          </Suspense>
        }
      />
      <form role="search" className="mb-5 grid gap-3 rounded-card border border-line bg-surface p-3 shadow-1 sm:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative">
          <span className="sr-only">Search by email</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Search by email" className="pl-9" />
        </label>
        <Select name="role" defaultValue={sp.role ?? ""} aria-label="Role">
          <option value="">Any role</option>
          <option value="MENTEE">Students</option>
          <option value="MENTOR">Mentors</option>
          <option value="HOD">HODs</option>
        </Select>
        <Select name="status" defaultValue={sp.status ?? ""} aria-label="Status">
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INVITED">Invited</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>
      {rows.length ? (
        <>
          <UsersTable rows={rows} meId={me.id} />
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-5 flex justify-between">
              <span className="text-small text-ink-500">
                Page {page} of {pages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link className="font-semibold text-pine-600 hover:underline" href={`/hod/users?${new URLSearchParams({ ...sp, page: String(page - 1) } as Record<string, string>)}`}>
                    ← Previous
                  </Link>
                )}
                {page < pages && (
                  <Link className="font-semibold text-pine-600 hover:underline" href={`/hod/users?${new URLSearchParams({ ...sp, page: String(page + 1) } as Record<string, string>)}`}>
                    Next →
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      ) : (
        <Card>
          <EmptyState illustration="search" title="No users match" body="Invite people one by one, or import a spreadsheet of students and mentors." action={<Link href="/hod/imports" className="font-semibold text-pine-600 hover:underline">Bulk import</Link>} />
        </Card>
      )}
    </>
  );
}
