"use client";

import { Copy, MailPlus, MoreHorizontal, UserCheck, UserPlus, UserX } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/shell/dock";
import { Button } from "@/components/ui/button";
import { Avatar, StatusPill } from "@/components/ui/display";
import { Field, Input, Select } from "@/components/ui/form";
import { fmtDate } from "@/lib/dates";
import { copyInviteLink, copyResetLink, inviteUser, resendInvite, setUserRole, setUserStatus, suspendUser } from "@/server/admin/actions";

export type UserRow = { id: string; email: string; name: string; role: "MENTEE" | "MENTOR" | "HOD"; status: string; created_at: string; last_seen_at: string | null };
export type MentorOption = { id: string; email: string; name: string; mentees: number; capacity: number | null };

/**
 * Suspend by email (header button) or for a given person (row button). A mentor with current
 * students must hand them to another mentor (or leave them unassigned) first.
 */
function SuspendSheet({ open, onOpenChange, mentors, preset }: { open: boolean; onOpenChange: (o: boolean) => void; mentors: MentorOption[]; preset?: { email: string; name: string } }) {
  const router = useRouter();
  const [v, setV] = useState({ user: preset?.email ?? "", moveTo: "", reason: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  useEffect(() => {
    if (open) {
      setV({ user: preset?.email ?? "", moveTo: "", reason: "" });
      setErrs({});
    }
  }, [open, preset?.email]);
  const target = mentors.find((m) => m.email.toLowerCase() === v.user.trim().toLowerCase());
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={preset ? `Suspend ${preset.name || preset.email}` : "Suspend a user"} description="They're signed out straight away and can't sign in until you reactivate them. Their records stay; nothing is deleted.">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await suspendUser(v);
            if (!r.ok) {
              setErrs(r.error.fieldErrors ?? {});
              return void toast.error(r.error.message);
            }
            toast.success(`${r.data.email} is suspended`);
            onOpenChange(false);
            router.refresh();
          });
        }}
      >
        {!preset && (
          <Field label="Email" htmlFor="sus-email" required error={errs.user}>
            <Input id="sus-email" type="email" value={v.user} onChange={(e) => setV({ ...v, user: e.target.value })} />
          </Field>
        )}
        {target && target.mentees > 0 && (
          <Field label={`Move their ${target.mentees} student${target.mentees === 1 ? "" : "s"} to`} htmlFor="sus-move" required error={errs.moveTo} helper="Open questions move with the students. You can rebalance later on the Assignments board.">
            <Select id="sus-move" value={v.moveTo} onChange={(e) => setV({ ...v, moveTo: e.target.value })}>
              <option value="">Choose a mentor…</option>
              {mentors
                .filter((m) => m.id !== target.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.mentees}
                    {m.capacity ? `/${m.capacity}` : ""} students)
                  </option>
                ))}
              <option value="unassign">Leave them unassigned for now</option>
            </Select>
          </Field>
        )}
        <Field label="Reason" htmlFor="sus-reason" optional helper="Kept in the audit log.">
          <Input id="sus-reason" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} />
        </Field>
        <Button type="submit" size="lg" variant="destructive" loading={pending}>
          <UserX /> Suspend
        </Button>
      </form>
    </BottomSheet>
  );
}

export function SuspendButton({ mentors }: { mentors: MentorOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <UserX /> Suspend a user
      </Button>
      <SuspendSheet open={open} onOpenChange={setOpen} mentors={mentors} />
    </>
  );
}

/** A one-time link with a copy button, for when email isn't available. */
function ShareLink({ link, email, reason, purpose = "set their password" }: { link: string; email: string; reason?: string | null; purpose?: string }) {
  const copy = () =>
    navigator.clipboard.writeText(link).then(
      () => toast.success("Link copied"),
      () => toast.error("Couldn't copy. Select the link and copy it manually."),
    );
  return (
    <div className="grid gap-3 rounded-card border border-line bg-mint-50 p-4">
      {reason && <p className="text-small font-semibold text-ink-900">{reason}</p>}
      <p className="text-small text-ink-700">
        Send this link to <span className="font-semibold">{email}</span> (WhatsApp, chat or your own email). It works once, for a limited time, and lets them {purpose}.
      </p>
      <Input readOnly value={link} aria-label="Link" onFocus={(e) => e.currentTarget.select()} />
      <Button type="button" onClick={copy}>
        <Copy /> Copy link
      </Button>
    </div>
  );
}

export function InviteButton() {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ email: "", role: "MENTEE", full_name: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [shared, setShared] = useState<{ email: string; link: string; reason: string | null } | null>(null);
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
      <BottomSheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setShared(null);
        }}
        title="Invite someone to Elevo"
        description="They receive a branded email to set a password. Roles are only ever set here."
      >
        {shared ? (
          <div className="grid gap-4">
            <ShareLink link={shared.link} email={shared.email} reason={shared.reason ? `Account created, but the email wasn't sent. ${shared.reason}` : null} />
            <Button variant="ghost" onClick={() => setShared(null)}>
              <UserPlus /> Invite someone else
            </Button>
          </div>
        ) : (
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
              setV({ email: "", role: v.role, full_name: "" });
              router.refresh();
              if (r.data.link) return void setShared({ email: v.email, link: r.data.link, reason: r.data.emailError });
              toast.success(`Invite sent to ${v.email}`);
              setOpen(false);
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
        )}
      </BottomSheet>
    </>
  );
}

export function UsersTable({ rows, meId, mentors }: { rows: UserRow[]; meId: string; mentors: MentorOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [share, setShare] = useState<{ email: string; link: string; kind: "invite" | "reset" } | null>(null);
  const [suspending, setSuspending] = useState<UserRow | null>(null);
  const getLink = (u: UserRow, kind: "invite" | "reset") =>
    start(async () => {
      const r = await (kind === "invite" ? copyInviteLink(u.id) : copyResetLink(u.id));
      if (!r.ok) return void toast.error(r.error.message);
      setShare({ email: u.email, link: r.data, kind });
    });
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
    <>
    <SuspendSheet open={!!suspending} onOpenChange={(o) => !o && setSuspending(null)} mentors={mentors} preset={suspending ? { email: suspending.email, name: suspending.name } : undefined} />
    <BottomSheet
      open={!!share}
      onOpenChange={(o) => !o && setShare(null)}
      title={share?.kind === "reset" ? "Password-reset link" : "Invite link"}
      description={share?.kind === "reset" ? "A one-time link that lets them choose a new password. Their current password keeps working until they do." : "A fresh one-time link. Any earlier invite link for this person stops working."}
    >
      {share && <ShareLink link={share.link} email={share.email} purpose={share.kind === "reset" ? "choose a new password" : "set their password"} />}
    </BottomSheet>
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
          {u.id !== meId &&
            (u.status === "SUSPENDED" ? (
              <Button variant="secondary" size="sm" onClick={() => run(() => setUserStatus(u.id, "ACTIVE"), "Reactivated")}>
                <UserCheck /> Reactivate
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="text-coral-700 hover:bg-coral-50" onClick={() => setSuspending(u)}>
                <UserX /> Suspend
              </Button>
            ))}
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
                {u.status === "INVITED" && (
                  <DropdownMenu.Item onSelect={() => getLink(u, "invite")} className="flex min-h-10 cursor-pointer items-center rounded-control px-3 text-small font-semibold text-ink-700 outline-none data-[highlighted]:bg-canvas-sunk">
                    Copy invite link
                  </DropdownMenu.Item>
                )}
                {u.status === "ACTIVE" && u.id !== meId && (
                  <DropdownMenu.Item onSelect={() => getLink(u, "reset")} className="flex min-h-10 cursor-pointer items-center rounded-control px-3 text-small font-semibold text-ink-700 outline-none data-[highlighted]:bg-canvas-sunk">
                    Copy password-reset link
                  </DropdownMenu.Item>
                )}
                {u.id !== meId &&
                  (u.status === "SUSPENDED" ? (
                    <DropdownMenu.Item onSelect={() => run(() => setUserStatus(u.id, "ACTIVE"), "Reactivated")} className="flex min-h-10 cursor-pointer items-center rounded-control px-3 text-small font-semibold text-pine-700 outline-none data-[highlighted]:bg-pine-50">
                      Reactivate
                    </DropdownMenu.Item>
                  ) : (
                    <DropdownMenu.Item
                      onSelect={() => setSuspending(u)}
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
    </>
  );
}
