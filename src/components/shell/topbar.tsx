"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { formatDistanceToNowStrict } from "date-fns";
import { Bell, Check, Clock, LogOut, MessageCircleQuestion, Search, Settings, User } from "lucide-react";
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/display";
import { browserDb } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";
import type { Role } from "@/server/authz";
import {
  listNotifications,
  markNotifications,
  type NotificationRow,
  searchPeople,
  type SearchHit,
  signOut,
  snoozeNotification,
} from "@/server/actions/shell";
import { BottomSheet } from "./dock";
import { NAV, QUICK } from "./nav";

type Me = { id: string; name: string; email: string; role: Role; avatarUrl: string | null };

export function TopBar({ me, title }: { me: Me; title?: string }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/86 backdrop-blur-[14px]">
      <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-3 px-4 md:h-16 md:px-6">
        <Link href={NAV[me.role].dock[0].href} className="shrink-0 rounded-control" aria-label="Elevo home">
          <Logo size="sm" className="hidden md:block" />
          <Logo variant="mark" size="md" className="md:hidden" />
        </Link>
        {title && <span className="truncate font-display text-h3 font-semibold text-ink-900 md:hidden">{title}</span>}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mx-auto hidden h-10 w-full max-w-md items-center gap-2 rounded-control border border-line bg-surface px-3 text-small text-ink-500 shadow-1 hover:border-line-strong lg:flex"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search {me.role === "MENTEE" ? "pages and actions" : "students, subjects, pages"}…</span>
          <kbd className="rounded-md border border-line bg-canvas-sunk px-1.5 py-0.5 text-[11px] font-semibold text-ink-500">Ctrl K</kbd>
        </button>
        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Search" className="flex size-11 items-center justify-center rounded-control text-ink-700 hover:bg-canvas-sunk lg:hidden">
            <Search className="size-5" />
          </button>
          {me.role !== "HOD" && (
            <Link
              href={me.role === "MENTEE" ? "/mentee/ask" : "/mentor/inbox"}
              aria-label={me.role === "MENTEE" ? "Ask my mentor" : "Questions inbox"}
              className="hidden size-11 items-center justify-center rounded-control text-ink-700 hover:bg-canvas-sunk md:flex"
            >
              <MessageCircleQuestion className="size-5" strokeWidth={1.75} />
            </Link>
          )}
          <NotificationBell userId={me.id} />
          <AccountMenu me={me} />
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={me.role} />
    </header>
  );
}

function AccountMenu({ me }: { me: Me }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger aria-label="Account menu" className="ml-1 rounded-avatar">
        <Avatar name={me.name} src={me.avatarUrl} size={36} ring />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-64 rounded-card border border-line bg-surface p-2 shadow-dock">
          <div className="px-3 py-2">
            <p className="truncate font-semibold text-ink-900">{me.name}</p>
            <p className="truncate text-small text-ink-500">{me.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          {me.role === "MENTEE" && (
            <DropdownMenu.Item asChild>
              <Link href="/mentee/profile" className="flex min-h-11 items-center gap-3 rounded-control px-3 font-semibold text-ink-700 outline-none data-[highlighted]:bg-canvas-sunk">
                <User className="size-4" /> My profile
              </Link>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item asChild>
            <Link href="/account" className="flex min-h-11 items-center gap-3 rounded-control px-3 font-semibold text-ink-700 outline-none data-[highlighted]:bg-canvas-sunk">
              <Settings className="size-4" /> Account & notifications
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => void signOut()}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 font-semibold text-coral-700 outline-none data-[highlighted]:bg-coral-50"
          >
            <LogOut className="size-4" /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function groupOf(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  if (now.getTime() - d.getTime() < 7 * 86_400_000) return "This week";
  return "Earlier";
}

export function NotificationList({ rows, onAction, compact }: { rows: NotificationRow[]; onAction: () => void; compact?: boolean }) {
  const [pending, start] = useTransition();
  const groups = ["Today", "This week", "Earlier"].map((g) => ({ g, items: rows.filter((r) => groupOf(r.created_at) === g) })).filter((x) => x.items.length);
  if (!rows.length)
    return <p className="px-3 py-8 text-center text-body text-ink-500">You&apos;re all caught up. New feedback, replies and reminders will appear here.</p>;
  return (
    <div className={cn("grid gap-4", pending && "opacity-70")}>
      {groups.map(({ g, items }) => (
        <section key={g}>
          <h3 className="label-caps mb-1.5 px-3">{g}</h3>
          <ul className="grid gap-1">
            {items.map((n) => (
              <li key={n.id} className={cn("group relative rounded-panel px-3 py-2.5", !n.read_at ? "bg-mint-50" : "hover:bg-canvas-sunk")}>
                <div className="flex items-start gap-3">
                  <span aria-hidden className={cn("mt-2 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-pine-600")} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900">{n.title}</p>
                    {n.body && <p className={cn("text-small text-ink-700", compact && "line-clamp-2")}>{n.body}</p>}
                    <p className="mt-0.5 text-small text-ink-500">{formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => start(async () => void (await markNotifications([n.id])))}
                          className="inline-flex min-h-8 items-center rounded-control px-2 text-small font-semibold text-pine-600 hover:bg-pine-50"
                        >
                          Open
                        </Link>
                      )}
                      {!n.read_at && (
                        <button type="button" onClick={() => start(async () => { await markNotifications([n.id]); onAction(); })} className="inline-flex min-h-8 items-center gap-1 rounded-control px-2 text-small font-semibold text-ink-700 hover:bg-canvas-sunk">
                          <Check className="size-3.5" /> Mark done
                        </button>
                      )}
                      <button type="button" onClick={() => start(async () => { await snoozeNotification(n.id); onAction(); })} className="inline-flex min-h-8 items-center gap-1 rounded-control px-2 text-small font-semibold text-ink-700 hover:bg-canvas-sunk">
                        <Clock className="size-3.5" /> Snooze 1 day
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function NotificationBell({ userId }: { userId: string }) {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const load = useCallback(async () => {
    const r = await listNotifications(30);
    if (r.ok) {
      setRows(r.data.rows);
      setUnread(r.data.unread);
    }
  }, []);
  useEffect(() => {
    void load();
    const supabase = browserDb();
    const ch = supabase
      .channel(`notif-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [userId, load]);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setMobile(mq.matches);
    const f = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);

  const trigger = (
    <span className="relative flex size-11 items-center justify-center rounded-control text-ink-700 hover:bg-canvas-sunk">
      <Bell className="size-5" strokeWidth={1.75} />
      {unread > 0 && (
        <span className="absolute top-1.5 right-1.5 flex min-w-5 items-center justify-center rounded-full bg-coral-600 px-1 text-[11px] leading-5 font-bold text-white tnum">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </span>
  );
  const header = (
    <div className="mb-2 flex items-center justify-between gap-2 px-1">
      <Link href="/notifications" onClick={() => setOpen(false)} className="text-small font-semibold text-pine-600 hover:underline">
        View all
      </Link>
      {unread > 0 && (
        <button type="button" onClick={async () => { await markNotifications("all"); void load(); }} className="min-h-9 rounded-control px-2 text-small font-semibold text-ink-700 hover:bg-canvas-sunk">
          Mark all read
        </button>
      )}
    </div>
  );
  const label = `Notifications${unread ? `, ${unread} unread` : ""}`;
  if (mobile)
    return (
      <>
        <button type="button" aria-label={label} onClick={() => setOpen(true)}>
          {trigger}
        </button>
        <BottomSheet open={open} onOpenChange={setOpen} title="Notifications" side="bottom">
          {header}
          <NotificationList rows={rows} onAction={load} compact />
        </BottomSheet>
      </>
    );
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger aria-label={label}>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 max-h-[70vh] w-[400px] overflow-y-auto rounded-card border border-line bg-surface p-3 shadow-dock">
          <h2 className="mb-1 px-1 font-display text-h3 font-semibold text-ink-900">Notifications</h2>
          {header}
          <NotificationList rows={rows} onAction={load} compact />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function CommandPalette({ open, onOpenChange, role }: { open: boolean; onOpenChange: (v: boolean) => void; role: Role }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem("elevo:recent-search") ?? "[]"));
    } catch {
      setRecent([]);
    }
  }, [open]);
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2 || role === "MENTEE") return setHits([]);
    timer.current = setTimeout(async () => {
      const r = await searchPeople(q);
      if (r.ok) setHits(r.data);
    }, 180);
  }, [q, role]);
  const go = (href: string) => {
    if (q.trim().length >= 2) {
      const next = [q.trim(), ...recent.filter((x) => x !== q.trim())].slice(0, 5);
      try {
        localStorage.setItem("elevo:recent-search", JSON.stringify(next));
      } catch {}
    }
    onOpenChange(false);
    setQ("");
    router.push(href);
  };
  const pages = [...NAV[role].dock, ...NAV[role].more];
  const itemCls = "flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 text-body text-ink-700 data-[selected=true]:bg-pine-50 data-[selected=true]:text-pine-700";
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search Elevo"
      overlayClassName="fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-[2px]"
      contentClassName="fixed top-[12vh] left-1/2 z-50 w-[min(620px,94vw)] -translate-x-1/2 overflow-hidden rounded-card border border-line bg-surface shadow-dock"
    >
      <div className="flex items-center gap-2 border-b border-line px-4">
        <Search className="size-5 text-ink-500" aria-hidden />
        <Command.Input value={q} onValueChange={setQ} placeholder={role === "MENTEE" ? "Jump to a page or action…" : "Search students, mentors, pages…"} className="h-14 flex-1 bg-transparent text-body text-ink-900 outline-none placeholder:text-ink-450" />
      </div>
      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-ink-500">No matches. Try a name, USN or page.</Command.Empty>
        {hits.length > 0 && (
          <Command.Group heading="People" className="[&_[cmdk-group-heading]]:label-caps [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
            {hits.map((h) => (
              <Command.Item key={h.href} value={`${h.label} ${h.sub}`} onSelect={() => go(h.href)} className={itemCls}>
                <Avatar name={h.label} size={28} />
                <span className="flex-1 truncate font-semibold text-ink-900">{h.label}</span>
                <span className="truncate text-small text-ink-500">{h.sub}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {!q && recent.length > 0 && role !== "MENTEE" && (
          <Command.Group heading="Recent searches" className="[&_[cmdk-group-heading]]:label-caps [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
            {recent.map((r) => (
              <Command.Item key={r} value={`recent ${r}`} onSelect={() => setQ(r)} className={itemCls}>
                <Clock className="size-4" /> {r}
              </Command.Item>
            ))}
          </Command.Group>
        )}
        <Command.Group heading="Quick actions" className="[&_[cmdk-group-heading]]:label-caps [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
          {QUICK[role].map((a) => (
            <Command.Item key={a.href} value={a.label} onSelect={() => go(a.href)} className={itemCls}>
              <a.icon className="size-4" strokeWidth={1.75} /> {a.label}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Pages" className="[&_[cmdk-group-heading]]:label-caps [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
          {pages.map((p) => (
            <Command.Item key={p.href} value={`${p.label} ${p.keywords ?? ""}`} onSelect={() => go(p.href)} className={itemCls}>
              <p.icon className="size-4" strokeWidth={1.75} /> {p.label}
            </Command.Item>
          ))}
          <Command.Item value="account notifications settings password" onSelect={() => go("/account")} className={itemCls}>
            <Settings className="size-4" /> Account & notifications
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
