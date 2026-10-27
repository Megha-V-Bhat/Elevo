"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  suggestions = [],
  max = 20,
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const add = (t: string) => {
    const v = t.trim().replace(/,$/, "");
    if (!v || value.includes(v) || value.length >= max) return;
    onChange([...value, v]);
    setDraft("");
  };
  const unused = suggestions.filter((s) => !value.includes(s)).slice(0, 6);
  return (
    <div>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-control border border-line bg-surface px-2 py-1.5 shadow-1 focus-within:border-pine-600 focus-within:outline-2 focus-within:outline-pine-100">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-mint-100 py-1 pr-1 pl-2.5 text-small font-semibold text-pine-700">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="flex size-6 items-center justify-center rounded-full hover:bg-mint-50">
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="min-w-32 flex-1 bg-transparent px-1 text-body text-ink-900 outline-none placeholder:text-ink-450"
        />
      </div>
      {unused.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className={cn("min-h-8 rounded-full border border-dashed border-line-strong px-3 text-small font-semibold text-ink-700 hover:border-pine-600 hover:text-pine-700")}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
