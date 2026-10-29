"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Thin bar at the top of the screen from the moment an in-app link is clicked until the
 * next page is on screen. Pages wait on the database, so without it a click looks ignored.
 */
function Bar() {
  const path = usePathname();
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);

  // Navigation finished: the URL the app renders has changed.
  useEffect(() => setBusy(false), [path, search]);

  useEffect(() => {
    let safety: ReturnType<typeof setTimeout>;
    // Capture phase: next/link calls preventDefault() on its own clicks, so a bubbling
    // listener can't tell a Link navigation from a cancelled click.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const to = new URL(a.href, location.href);
      if (to.origin !== location.origin || to.pathname.startsWith("/api/")) return;
      if (to.pathname === location.pathname && to.search === location.search) return;
      setBusy(true);
      clearTimeout(safety);
      safety = setTimeout(() => setBusy(false), 20_000);
    };
    const onPop = () => setBusy(true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      clearTimeout(safety);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  return (
    <>
      <div aria-hidden className={cn("pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden transition-opacity duration-200", busy ? "opacity-100" : "opacity-0")}>
        <div className="nav-progress h-full w-1/3 rounded-full bg-pine-600" />
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {busy ? "Loading page" : ""}
      </span>
    </>
  );
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
