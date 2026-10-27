import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { cn, initials, tintFor } from "@/lib/utils";

export function Card({ className, interactive, ...props }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface p-5 shadow-1",
        interactive &&
          "transition-[transform,box-shadow,border-color] duration-[220ms] ease-grow hover:-translate-y-px hover:border-pine-100 hover:shadow-2",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  icon: Icon,
  tone = "mint",
  action,
  subtitle,
}: {
  title: string;
  icon?: LucideIcon;
  tone?: Tone;
  action?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && <IconTile icon={Icon} tone={tone} />}
        <div className="min-w-0">
          <h2 className="font-display text-h3 font-semibold text-ink-900">{title}</h2>
          {subtitle && <p className="text-small text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export type Tone = "mint" | "lilac" | "butter" | "coral" | "sky" | "pine" | "neutral";

const ICON_TONE: Record<Tone, string> = {
  mint: "text-pine-600",
  lilac: "text-lilac-700",
  butter: "text-butter-800",
  coral: "text-coral-700",
  sky: "text-sky-700",
  pine: "text-pine-700",
  neutral: "text-ink-700",
};
export const TILE_BG: Record<Tone, string> = {
  mint: "bg-mint-50",
  lilac: "bg-lilac-50",
  butter: "bg-butter-50",
  coral: "bg-coral-50",
  sky: "bg-sky-100/60",
  pine: "bg-pine-50",
  neutral: "bg-canvas-sunk",
};

export function IconTile({ icon: Icon, tone = "mint", size = "md" }: { icon: LucideIcon; tone?: Tone; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-control border border-line bg-surface",
        size === "md" ? "size-10" : "size-8",
        ICON_TONE[tone],
      )}
    >
      <Icon className={size === "md" ? "size-5" : "size-4"} strokeWidth={1.75} />
    </span>
  );
}

export function Chip({ className, children, tone = "neutral" }: { className?: string; children: React.ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-canvas-sunk text-ink-700",
    mint: "bg-mint-100 text-pine-700",
    lilac: "bg-lilac-100 text-lilac-700",
    butter: "bg-butter-100 text-butter-800",
    coral: "bg-coral-100 text-coral-700",
    sky: "bg-sky-100 text-sky-700",
    pine: "bg-pine-600 text-white",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label font-semibold whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-canvas-sunk text-ink-500" },
  SUBMITTED: { label: "Submitted", cls: "bg-lilac-100 text-lilac-700" },
  VERIFIED: { label: "Verified", cls: "bg-pine-600 text-white" },
  FINALIZED: { label: "Finalized", cls: "bg-pine-800 text-white" },
  CHANGE_REQUESTED: { label: "Change requested", cls: "bg-butter-100 text-butter-800" },
  PENDING: { label: "Pending", cls: "bg-butter-100 text-butter-800" },
  IN_PROGRESS: { label: "In progress", cls: "bg-sky-100 text-sky-700" },
  COMPLETED: { label: "Completed", cls: "bg-mint-100 text-pine-700" },
  OPEN: { label: "Open", cls: "bg-lilac-100 text-lilac-700" },
  ANSWERED: { label: "Answered", cls: "bg-sky-100 text-sky-700" },
  RESOLVED: { label: "Resolved", cls: "bg-mint-100 text-pine-700" },
  SCHEDULED: { label: "Scheduled", cls: "bg-sky-100 text-sky-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-canvas-sunk text-ink-500" },
  APPROVED: { label: "Approved", cls: "bg-mint-100 text-pine-700" },
  REJECTED: { label: "Declined", cls: "bg-coral-100 text-coral-700" },
  ACTIVE: { label: "Active", cls: "bg-mint-100 text-pine-700" },
  INVITED: { label: "Invited", cls: "bg-lilac-100 text-lilac-700" },
  SUSPENDED: { label: "Suspended", cls: "bg-coral-100 text-coral-700" },
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = STATUS[status] ?? { label: status, cls: "bg-canvas-sunk text-ink-700" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-label font-semibold whitespace-nowrap", s.cls, className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      {s.label}
    </span>
  );
}

export function Avatar({
  name,
  src,
  size = 40,
  ring,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-avatar font-semibold",
        !src && tintFor(name),
        ring && "ring-2 ring-mint-400 ring-offset-2 ring-offset-surface",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton h-4", className)} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-line", className)} />;
}

export function DeltaChip({ value, label, digits = 2 }: { value: number | null; label: string; digits?: number }) {
  if (value == null) return <span className="text-small text-ink-500">No comparison yet</span>;
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label font-semibold",
        flat ? "bg-canvas-sunk text-ink-700" : up ? "bg-mint-100 text-pine-700" : "bg-coral-100 text-coral-700",
      )}
    >
      <span aria-hidden>{flat ? "→" : up ? "↑" : "↓"}</span>
      {up ? "+" : ""}
      {value.toFixed(digits)} {label}
    </span>
  );
}

export function Meter({ value, max = 100, label, tone = "pine" }: { value: number; max?: number; label: string; tone?: "pine" | "coral" | "butter" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const colors = { pine: "bg-pine-600", coral: "bg-coral-600", butter: "bg-butter-500" };
  return (
    <div role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className="h-2 w-full overflow-hidden rounded-full bg-chart-track">
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-grow", colors[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
