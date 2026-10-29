import Link from "@/components/ui/link";
import { cn } from "@/lib/utils";

/** Chip-style tab strip with the growing mint "sprout" underline on the active chip. URL-driven, no JS. */
export function TabStrip({ tabs, active, label }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 mb-6 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1.5 border-b border-line pb-px">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "group relative inline-flex min-h-11 items-center gap-1.5 rounded-t-control px-3.5 text-small font-semibold transition-colors",
                  on ? "text-pine-700" : "text-ink-500 hover:text-ink-900",
                )}
              >
                {t.label}
                {t.count != null && t.count > 0 && (
                  <span className={cn("rounded-full px-1.5 text-[11px] leading-5 tnum", on ? "bg-mint-100 text-pine-700" : "bg-canvas-sunk text-ink-700")}>{t.count}</span>
                )}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-2 -bottom-px h-[3px] origin-left rounded-full bg-mint-400 transition-transform duration-[360ms] ease-grow",
                    on ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
