import type { LucideIcon } from "lucide-react";
import Link from "@/components/ui/link";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Illustration, type IllustrationName } from "@/components/illustrations";
import { Button } from "./button";
import { IconTile, TILE_BG, type Tone } from "./display";

export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 animate-rise">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="font-display text-[2rem] leading-[2.375rem] font-bold text-ink-900 md:text-display-l md:leading-display-l">{title}</h1>
        {subtitle && <p className="mt-2 max-w-[68ch] text-body text-ink-500">{subtitle}</p>}
      </div>
      {action && <div className="flex w-full shrink-0 flex-wrap gap-2 md:w-auto [&>*]:flex-1 md:[&>*]:flex-none">{action}</div>}
    </header>
  );
}

/** 12-col bento on desktop, 6 on tablet, single column (or 2-up tiles) on mobile. */
export function Bento({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5 lg:grid-cols-12", className)}>{children}</div>;
}

export function StatTile({
  label,
  value,
  icon,
  tone = "mint",
  helper,
  href,
  delta,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  helper?: React.ReactNode;
  href?: string;
  delta?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <IconTile icon={icon} tone={tone} />
        {delta}
      </div>
      <div className="mt-4">
        <div className="font-display text-[2.25rem] leading-[2.5rem] font-bold text-ink-900 tnum md:text-stat md:leading-stat">{value}</div>
        <div className="mt-1 text-small font-semibold text-ink-700">{label}</div>
        {helper && <div className="mt-0.5 text-small text-ink-500">{helper}</div>}
      </div>
    </>
  );
  const cls = cn(
    "block rounded-card border border-line p-4 shadow-1 md:p-5",
    TILE_BG[tone],
    href && "transition-[transform,box-shadow,border-color] duration-[220ms] ease-grow hover:-translate-y-px hover:border-pine-100 hover:shadow-2",
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** The one Sunrise hero card per page: white text on the pine half, graphics on the light half. */
export function HeroCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("relative overflow-hidden rounded-hero bg-sunrise p-6 text-white shadow-hero md:p-8", className)}>
      <div aria-hidden className="dot-grid-light pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-mint-300/20 blur-3xl" />
      <div className="relative">{children}</div>
    </section>
  );
}

export function EmptyState({
  illustration,
  title,
  body,
  action,
  compact,
}: {
  illustration: IllustrationName;
  title: string;
  body?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "py-6" : "py-10")}>
      <div className="bloom-wash relative grid place-items-center">
        <Illustration name={illustration} className={compact ? "h-28 w-auto" : "h-40 w-auto"} />
      </div>
      <h3 className="mt-4 font-display text-h3 font-semibold text-ink-900">{title}</h3>
      {body && <p className="mt-1 max-w-[44ch] text-body text-ink-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retryHref }: { message?: string; retryHref?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-card border border-coral-100 bg-coral-50 px-6 py-8 text-center">
      <Illustration name="error" className="h-28 w-auto" />
      <h3 className="mt-3 font-display text-h3 font-semibold text-ink-900">We couldn&apos;t load this</h3>
      <p className="mt-1 max-w-[44ch] text-body text-ink-700">{message ?? "Check your connection and try again."}</p>
      {retryHref && (
        <Button asChild variant="secondary" className="mt-4">
          <Link href={retryHref}>Try again</Link>
        </Button>
      )}
    </div>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("mt-8", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-h3 font-semibold text-ink-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function KeyValue({ items }: { items: { k: string; v: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.k} className="min-w-0">
          <dt className="label-caps">{i.k}</dt>
          <dd className="mt-0.5 truncate text-body text-ink-900">{i.v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
