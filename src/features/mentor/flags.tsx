import { HeartPulse, TriangleAlert } from "lucide-react";
import type { PulseSignal } from "@/lib/engine/pulse";
import type { RiskFlag } from "@/lib/engine/risk";

/** Reason chips: every flag shows its reason on hover/focus and in text for screen readers. */
export function FlagChips({ flags, pulse, max = 3 }: { flags: RiskFlag[]; pulse?: PulseSignal[]; max?: number }) {
  const items = [
    ...flags.map((f) => ({ k: f.ruleId, label: f.label, reason: f.reason, pulse: false })),
    ...(pulse ?? []).map((p) => ({ k: p.ruleId + p.label, label: p.label, reason: `${p.reason} (self-reported)`, pulse: true })),
  ];
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.slice(0, max).map((i) => (
        <li key={i.k}>
          <span
            title={i.reason}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label font-semibold ${i.pulse ? "bg-lilac-100 text-lilac-700" : "bg-coral-100 text-coral-700"}`}
          >
            {i.pulse ? <HeartPulse className="size-3" aria-hidden /> : <TriangleAlert className="size-3" aria-hidden />}
            {i.label}
            {i.pulse && <span className="font-medium opacity-80">· self-reported</span>}
            <span className="sr-only">: {i.reason}</span>
          </span>
        </li>
      ))}
      {items.length > max && <li className="text-label font-semibold text-ink-500">+{items.length - max} more</li>}
    </ul>
  );
}
