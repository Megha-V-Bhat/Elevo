"use client";

import { ArrowRight, Sparkles, X } from "lucide-react";
import Link from "@/components/ui/link";
import { useEffect, useState } from "react";

/** One data-driven next action. Dismissible per day (per-viewer convenience, stored locally). */
export function NextStepCard({ id, title, body, href, cta }: { id: string; title: string; body: string; href: string; cta: string }) {
  const key = `elevo:next-step:${id}:${new Date().toISOString().slice(0, 10)}`;
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === "1");
    } catch {}
  }, [key]);
  if (hidden) return null;
  return (
    <div className="relative h-full rounded-card border border-lilac-100 bg-lilac-50 p-5 shadow-1">
      <button
        type="button"
        aria-label="Dismiss for today"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(key, "1");
          } catch {}
        }}
        className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-control text-ink-500 hover:bg-lilac-100"
      >
        <X className="size-4" />
      </button>
      <p className="label-caps flex items-center gap-1.5 !text-lilac-700">
        <Sparkles className="size-3.5" aria-hidden /> Next step
      </p>
      <h2 className="mt-2 pr-8 font-display text-h3 font-semibold text-ink-900">{title}</h2>
      <p className="mt-1 text-body text-ink-700">{body}</p>
      <Link href={href} className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-control bg-pine-600 px-4 font-semibold text-white hover:bg-pine-700">
        {cta} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
