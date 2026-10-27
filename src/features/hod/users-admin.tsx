"use client";

import { MailPlus, MoreHorizontal, UserPlus } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/shell/dock";
import { Button } from "@/components/ui/button";
import { Avatar, StatusPill } from "@/components/ui/display";
import { Field, Input, Select } from "@/components/ui/form";
import { fmtDate } from "@/lib/dates";
import { inviteUser, resendInvite, setUserRole, setUserStatus } from "@/server/admin/actions";

export type UserRow = { id: string; email: string; name: string; role: "MENTEE" | "MENTOR" | "HOD"; status: string; created_at: string; last_seen_at: string | null };

export function InviteButton() {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ email: "", role: "MENTEE", full_name: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  useEffect(() => {
    if (params.get("invite") === "1") {
      setOpen(true);
      const r = params.get("role");
      if (r === "MENTOR" || r === "MENTEE" || r === "HOD") setV((x) => ({ ...x, role: r }));
    }
  }, [params]);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus /> Invite a user
      </Button>
      <BottomSheet open={open} onOpenChange={setOpen} title="Invite someone to Elevo" description="They receive a branded email to set a password. Roles are only ever set here.">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await inviteUser(v);
              if (!r.ok) {
                setErrs(r.error.fieldErrors ?? {});
                return void toast.error(r.error.message);
              }
              toast.success(`Invite sent to ${v.email}`);
              setV({ email: "", role: v.role, full_name: "" });
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <Field label="Email" htmlFor="inv-email" required error={errs.email}>
            <Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          </Field>
          <Field label="Full name" htmlFor="inv-name" optional>
            <Input value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
          </Field>
          <Field label="Role" htmlFor="inv-role" required>
            <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
              <option value="MENTEE">Student (mentee)</option>
              <option value="MENTOR">Mentor (faculty)</option>
              <option value="HOD">HOD (administrator)</option>
            </Select>
          </Field>
          <Button type="submit" size="lg" loading={pending}>
            <MailPlus /> Send invite
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}

export function UsersTable({ rows, meId }: { rows: UserRow[]; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error?.message ?? "Something went wrong");
      toast.success(msg);
      router.refresh();
    });
  const confirmRole = (u: UserRow, role: UserRow["role"]) =>
    toast(`Make ${u.name} a ${role === "MENTEE" ? "student" : role === "MENTOR" ? "mentor" : "HOD"}?`, {
      description: "This changes what they can see immediately and is recorded in the audit log.",
      action: { label: "Change role", onClick: () => run(() => setUserRole(u.id, role), "Role updated") },
    });
  return (
    <ul className={`grid gap-2 ${pending ? "opacity-70" : ""}`}>
      {rows.map((u) => (
        <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-1 sm:flex-nowrap">
          <Avatar name={u.name || u.email} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink-900">
              {u.name || "—"} {u.id === meId && <span className="text-small font-medium text-ink-500">(you)</span>}
            </p>
            <p className="truncate text-small text-ink-500">
              {u.email} · joined {fmtDate(u.created_at)}
            </p>
          </div>
          <span className="rounded-full bg-canvas-sunk px-2.5 py-0.5 text-label font-semibold text-ink-700">{u.role === "MENTEE" ? "Student" : u.role === "MENTOR" ? "Mentor" : "HOD"}</span>
          <StatusPill status={u.status} />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger aria-label={`Actions for ${u.email}`} className="flex size-11 items-center justify-center rounded-control text-ink-700 hover:bg-canvas-sunk">
              <MoreHorizontal className="size-5" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className="z-50 w-56 rounded-card border border-line bg-surface p-1.5 shadow-dock">
                {(["MENTEE", "MENTOR", "HOD"] as const)
                  .filter((r) => r !== u.role)
                  .map((r) => (
                    <DropdownMenu.Item key={r} onSelect={() => confirmRole(u, r)} className="flex min-h-10 cursor-pointer items-center rounded-control px-3 text-small font-semibold text-ink-700 outline-none data-[highlighted]:bg-canvas-sunk">
                      Make {r === "MENTEE" ? "student" : r === "MENTOR" ? "mentor" : "HOD"}
                    </DropdownMenu.Item>
                  ))}
                {u.status === "INVITED" && (
                  <DropdownMenu.Item onSelect={() => run(() => resendInvite(u.id), "Invite re-sent")} className="flex min-h-10 cursor-pointer items-center rounded-control px-3 text-small font-semibold text-ink-700 outline-none data-[highlighted]:bg-canvas-sunk">
                    Resend invite
                  </DropdownMenu.Item>
                )}
                {u.id !== meId &&
                  (u.status === "SUSPENDED" ? (
                    <DropdownMenu.Item onSelect={() => run(() => setUserStatus(u.id, "ACTIVE"), "Reactivated")} className="flex min-h-10 cursor-pointer items-center rounded-control px-3 text-small font-semibold text-pine-700 outline-none data-[highlighted]:bg-pine-50">
                      Reactivate
                    </DropdownMenu.Item>
                  ) : (
                    <DropdownMenu.Item
                      onSelect={() =>
                        toast(`Suspend ${u.name || u.email}?`, {
                          description: "They'll be signed out and blocked until reactivated.",
                          action: { label: "Suspend", onClick: () => run(() => setUserStatus(u.id, "SUSPENDED"), "Suspended") },
                        })
                      }
                      className="flex min-h-10 cursor-pointer items-center rounded-control px-3 text-small font-semibold text-coral-700 outline-none data-[highlighted]:bg-coral-50"
                    >
                      Suspend
                    </DropdownMenu.Item>
                  ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </li>
      ))}
    </ul>
  );
}
