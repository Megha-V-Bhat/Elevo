"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { LayoutGrid, MoreHorizontal, Plus, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/server/authz";
import { cn } from "@/lib/utils";
import { isActive, NAV, QUICK, type NavItem } from "./nav";

const HOME: Record<Role, string> = { MENTEE: "/mentee", MENTOR: "/mentor", HOD: "/hod" };

/** Floating dock — primary navigation on tablet and desktop. */
export function Dock({ role }: { role: Role }) {
  const path = usePathname();
  const reduce = useReducedMotion();
  const { dock, more } = NAV[role];
  const moreActive = more.some((m) => isActive(path, m.href, HOME[role]));
  return (
    <Tooltip.Provider delayDuration={250}>
      <nav
        aria-label="Primary"
        className="fixed bottom-6 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-1 rounded-dock border border-line/80 bg-white/86 p-1.5 shadow-dock backdrop-blur-[14px] md:flex"
      >
        {dock.map((item) => {
          const active = isActive(path, item.href, HOME[role]);
          return (
            <Tooltip.Root key={item.href}>
              <Tooltip.Trigger asChild>
                <Link
                  href={item.href}
                  prefetch={null}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  className={cn(
                    "relative flex h-11 items-center gap-2 rounded-[16px] px-3 text-small font-semibold transition-[color,transform] duration-[220ms] ease-grow",
                    active ? "text-white" : "text-ink-700 hover:scale-[1.06] hover:text-pine-700 motion-reduce:hover:scale-100",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="dock-pill"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                      className="absolute inset-0 rounded-[16px] bg-pine-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                    />
                  )}
                  <item.icon className="relative size-5" strokeWidth={1.75} aria-hidden />
                  {active && <span className="relative">{item.label}</span>}
                </Link>
              </Tooltip.Trigger>
              {!active && (
                <Tooltip.Portal>
                  <Tooltip.Content side="top" sideOffset={10} className="z-50 rounded-control bg-ink-900 px-2.5 py-1 text-small font-semibold text-white shadow-dock">
                    {item.label}
                  </Tooltip.Content>
                </Tooltip.Portal>
              )}
            </Tooltip.Root>
          );
        })}
        <span aria-hidden className="mx-1 h-6 w-px bg-line" />
        <Popover.Root>
          <Popover.Trigger
            aria-label="More pages"
            className={cn(
              "flex size-11 items-center justify-center rounded-[16px] text-ink-700 hover:bg-canvas-sunk",
              moreActive && "bg-pine-50 text-pine-700",
            )}
          >
            <MoreHorizontal className="size-5" strokeWidth={1.75} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content side="top" sideOffset={14} className="z-50 w-64 rounded-card border border-line bg-surface p-2 shadow-dock">
              <MoreList items={more} path={path} role={role} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </nav>
    </Tooltip.Provider>
  );
}

function MoreList({ items, path, role, onPick }: { items: NavItem[]; path: string; role: Role; onPick?: () => void }) {
  return (
    <ul className="grid gap-0.5">
      {items.map((m) => {
        const active = isActive(path, m.href, HOME[role]);
        return (
          <li key={m.href}>
            <Link
              href={m.href}
              onClick={onPick}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-control px-3 text-body font-semibold",
                active ? "bg-pine-50 text-pine-700" : "text-ink-700 hover:bg-canvas-sunk",
              )}
            >
              <m.icon className="size-5" strokeWidth={1.75} aria-hidden />
              {m.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Mobile bottom tab bar: 3 destinations + raised centre "+" + "More". */
export function MobileTabBar({ role }: { role: Role }) {
  const path = usePathname();
  const [quick, setQuick] = useState(false);
  const [more, setMore] = useState(false);
  const items = NAV[role].mobile;
  const tab = (item: NavItem) => {
    const active = isActive(path, item.href, HOME[role]);
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={null}
        aria-current={active ? "page" : undefined}
        className={cn("flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold active:scale-95", active ? "text-pine-700" : "text-ink-500")}
      >
        <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-mint-100")}>
          <item.icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        {item.label}
      </Link>
    );
  };
  return (
    <>
      <nav aria-label="Primary" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/92 backdrop-blur-[14px] md:hidden">
        <div className="mx-auto flex max-w-lg items-end px-2">
          {tab(items[0])}
          {tab(items[1])}
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={() => setQuick(true)}
              aria-label="Quick actions"
              className="-mt-6 flex size-14 items-center justify-center rounded-full bg-pine-600 text-white shadow-hero ring-4 ring-mint-100 active:scale-95"
            >
              <Plus className="size-7" strokeWidth={2} />
            </button>
          </div>
          {tab(items[2])}
          <button type="button" onClick={() => setMore(true)} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-ink-500 active:scale-95">
            <span className="flex h-7 w-12 items-center justify-center rounded-full">
              <LayoutGrid className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            More
          </button>
        </div>
      </nav>
      <BottomSheet open={quick} onOpenChange={setQuick} title="Quick actions">
        <ul className="grid grid-cols-2 gap-3">
          {QUICK[role].map((q) => (
            <li key={q.href}>
              <Link href={q.href} onClick={() => setQuick(false)} className="flex min-h-24 flex-col justify-between rounded-card border border-line bg-mint-50 p-4 active:scale-[0.98]">
                <q.icon className="size-6 text-pine-600" strokeWidth={1.75} aria-hidden />
                <span className="text-body font-semibold text-ink-900">{q.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </BottomSheet>
      <BottomSheet open={more} onOpenChange={setMore} title="All pages">
        <MoreList items={[...NAV[role].dock, ...NAV[role].more]} path={path} role={role} onPick={() => setMore(false)} />
      </BottomSheet>
    </>
  );
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "auto",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  side?: "auto" | "bottom";
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-[2px] data-[state=open]:animate-[rise_220ms_ease-out]" />
        <Dialog.Content
          className={cn(
            "safe-bottom fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-[28px] border border-line bg-surface p-5 pb-8 shadow-dock outline-none data-[state=open]:animate-[rise_360ms_cubic-bezier(0.22,1,0.36,1)]",
            side === "auto" && "md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[min(560px,92vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card md:pb-5",
          )}
        >
          <div aria-hidden className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line-strong md:hidden" />
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-h3 font-semibold text-ink-900">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-small text-ink-500">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close aria-label="Close" className="flex size-11 shrink-0 items-center justify-center rounded-control text-ink-500 hover:bg-canvas-sunk">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
