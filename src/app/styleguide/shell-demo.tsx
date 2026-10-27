"use client";

import { Bell, Search } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Dock, MobileTabBar } from "@/components/shell/dock";
import { Avatar } from "@/components/ui/display";

/** Static replica of the app shell (no auth) for design review of the Dock and tab bar. */
export function StyleguideShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/86 backdrop-blur-[14px]">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-3 px-4 md:h-16 md:px-6">
          <Logo size="sm" className="hidden md:block" />
          <Logo variant="mark" size="md" className="md:hidden" />
          <div className="mx-auto hidden h-10 w-full max-w-md items-center gap-2 rounded-control border border-line bg-surface px-3 text-small text-ink-500 shadow-1 lg:flex">
            <Search className="size-4" aria-hidden /> <span className="flex-1">Search students, subjects, pages…</span>
            <kbd className="rounded-md border border-line bg-canvas-sunk px-1.5 py-0.5 text-[11px] font-semibold">Ctrl K</kbd>
          </div>
          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <span className="relative flex size-11 items-center justify-center text-ink-700">
              <Bell className="size-5" strokeWidth={1.75} />
              <span className="absolute top-1.5 right-1.5 flex min-w-5 items-center justify-center rounded-full bg-coral-600 px-1 text-[11px] leading-5 font-bold text-white">3</span>
            </span>
            <Avatar name="Ananya Rao" size={36} ring />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1320px] px-4 pt-6 pb-32 md:px-6 md:pt-8 md:pb-[120px]">
        {children}
      </main>
      <Dock role="MENTEE" />
      <MobileTabBar role="MENTEE" />
    </div>
  );
}
