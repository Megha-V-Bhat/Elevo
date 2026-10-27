import Link from "next/link";
import * as React from "react";
import { cn, fmt } from "@/lib/utils";

/*
 * Signature data visuals (DESIGN.md §2.6). Pure SVG, server-rendered, token colours.
 * Every chart is wrapped in <ChartFrame>, which provides a native "View as table".
 */

export const SERIES = ["#0F766E", "#34D399", "#8B7CF6", "#FBBF24", "#0EA5E9", "#F06A6A", "#14B8A6"];
const TRACK = "#EEF2ED";
const GRID = "#EDF1EC";
const AXIS = "#6B7772";

export type TableSpec = { columns: string[]; rows: (string | number | null)[][] };

export function ChartFrame({
  title,
  description,
  table,
  children,
  className,
  bare,
}: {
  title: string;
  description?: string;
  table: TableSpec;
  children: React.ReactNode;
  className?: string;
  bare?: boolean;
}) {
  return (
    <figure className={cn(!bare && "rounded-card border border-line bg-surface p-5 shadow-1", className)} aria-label={title}>
      {!bare && (
        <figcaption className="mb-3">
          <h2 className="font-display text-h3 font-semibold text-ink-900">{title}</h2>
          {description && <p className="text-small text-ink-500">{description}</p>}
        </figcaption>
      )}
      {children}
      <details className="group mt-3">
        <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-control px-2 text-small font-semibold text-pine-600 hover:bg-pine-50 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">View as table</span>
          <span className="hidden group-open:inline">Hide table</span>
        </summary>
        <div className="mt-2 overflow-x-auto rounded-panel border border-line">
          <table className="w-full text-left text-small tnum">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-canvas-sunk text-ink-700">
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-2 text-ink-900">
                      {c ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

// ───────────── Growth Rings ─────────────
export function sgpaBand(s: number | null) {
  if (s == null) return { color: "#CFD8CF", label: "Not computed" };
  if (s >= 8.5) return { color: "#34D399", label: "8.5 and above" };
  if (s >= 7) return { color: "#14B8A6", label: "7 – 8.49" };
  if (s >= 6) return { color: "#8B7CF6", label: "6 – 6.99" };
  return { color: "#FBBF24", label: "Below 6" };
}

export function GrowthRings({
  semesters,
  cgpa,
  size = 220,
  onPine = false,
}: {
  semesters: { no: number; sgpa: number | null; credits: number | null }[];
  cgpa: number | null;
  size?: number;
  onPine?: boolean;
}) {
  const c = size / 2;
  const sorted = [...semesters].sort((a, b) => a.no - b.no);
  const maxCredits = Math.max(1, ...sorted.map((s) => s.credits ?? 18));
  const inner = size * 0.24;
  const outer = size / 2 - 6;
  const per = sorted.length ? (outer - inner) / sorted.length : 0;
  let r = inner;
  const rings = sorted.map((s, i) => {
    const thick = Math.max(4, Math.min(per - 2, per * (0.45 + 0.5 * ((s.credits ?? maxCredits * 0.6) / maxCredits))));
    const mid = r + per / 2;
    r += per;
    return { ...s, mid, thick, i };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="max-w-full" role="img" aria-label={`Growth rings: CGPA ${fmt(cgpa)} across ${sorted.length} semesters`}>
      {rings.map((g) => (
        <g key={g.no} tabIndex={0} aria-label={`Semester ${g.no}: SGPA ${fmt(g.sgpa)}, ${g.credits ?? "unknown"} credits`} className="outline-none focus-visible:[&>circle]:opacity-70">
          <title>{`Sem ${g.no} · SGPA ${fmt(g.sgpa)} · ${g.credits ?? "?"} credits`}</title>
          <circle cx={c} cy={c} r={g.mid} fill="none" stroke={onPine ? "rgba(255,255,255,0.12)" : TRACK} strokeWidth={g.thick} />
          <circle
            cx={c}
            cy={c}
            r={g.mid}
            fill="none"
            stroke={sgpaBand(g.sgpa).color}
            strokeWidth={g.thick}
            strokeLinecap="round"
            pathLength={1}
            transform={`rotate(-90 ${c} ${c})`}
            className="anim-draw"
            style={{ animationDelay: `${g.i * 90}ms`, strokeDasharray: g.sgpa == null ? "0.02 0.04" : undefined }}
          />
        </g>
      ))}
      <text x={c} y={c - 2} textAnchor="middle" className="font-display" fontSize={size * 0.17} fontWeight={700} fill={onPine ? "#FFFFFF" : "#10201B"}>
        {cgpa == null ? "—" : cgpa.toFixed(2)}
      </text>
      <text x={c} y={c + size * 0.09} textAnchor="middle" fontSize={Math.max(11, size * 0.05)} fontWeight={600} fill={onPine ? "rgba(255,255,255,0.86)" : AXIS}>
        {sorted.length ? `CGPA · ${sorted.length} sem` : "No semesters yet"}
      </text>
    </svg>
  );
}

export function RingLegend({ onPine }: { onPine?: boolean }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-small", onPine ? "text-white" : "text-ink-700")}>
      {[9, 7.5, 6.5, 5].map((v) => (
        <li key={v} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: sgpaBand(v).color }} />
          {sgpaBand(v).label}
        </li>
      ))}
    </ul>
  );
}

// ───────────── Trend line ─────────────
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.18;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    // clamp control points between neighbours to keep it monotone-ish
    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);
    d += ` C${p1.x + (p2.x - p1.x) / 3},${Math.min(hi, Math.max(lo, c1y))} ${p2.x - (p2.x - p1.x) / 3},${Math.min(hi, Math.max(lo, c2y))} ${p2.x},${p2.y}`;
  }
  return d;
}

export function TrendLine({
  points,
  min = 0,
  max = 10,
  height = 200,
  unit = "",
}: {
  points: { label: string; value: number | null }[];
  min?: number;
  max?: number;
  height?: number;
  unit?: string;
}) {
  const W = 420; // narrow viewBox so labels stay ≥ 11px on phones
  const H = height;
  const pad = { l: 40, r: 18, t: 30, b: 32 };
  const valid = points.map((p, i) => ({ ...p, i })).filter((p) => p.value != null) as { label: string; value: number; i: number }[];
  const lo = Math.max(min, Math.floor(Math.min(...valid.map((v) => v.value), max) - 1));
  const hi = Math.min(max, Math.ceil(Math.max(...valid.map((v) => v.value), min) + 0.5));
  const x = (i: number) => pad.l + (points.length <= 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + (1 - (v - lo) / Math.max(0.0001, hi - lo)) * (H - pad.t - pad.b);
  const pts = valid.map((v) => ({ x: x(v.i), y: y(v.value) }));
  const line = smoothPath(pts);
  const best = valid.reduce<(typeof valid)[number] | null>((b, v) => (!b || v.value > b.value ? v : b), null);
  const ticks = Array.from({ length: 4 }, (_, k) => lo + ((hi - lo) * k) / 3);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto max-h-[260px] w-full" role="img" aria-label={`Trend: ${valid.map((v) => `${v.label} ${v.value}`).join(", ") || "no data"}`}>
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0F766E" stopOpacity="0.22" />
          <stop offset="1" stopColor="#0F766E" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="15" fill={AXIS} className="tnum">
            {t.toFixed(1)}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <text key={p.label} x={x(i)} y={H - 8} textAnchor="middle" fontSize="15" fill={AXIS}>
          {p.label}
        </text>
      ))}
      {pts.length > 1 && (
        <path d={`${line} L${pts.at(-1)!.x},${H - pad.b} L${pts[0].x},${H - pad.b} Z`} fill="url(#trend-fill)" />
      )}
      {pts.length > 1 && <path d={line} fill="none" stroke="#0F766E" strokeWidth="3" strokeLinecap="round" pathLength={1} className="anim-draw" />}
      {valid.map((v, k) => {
        const prev = valid[k - 1];
        const delta = prev ? v.value - prev.value : null;
        return (
          <g key={v.label} tabIndex={0} aria-label={`${v.label}: ${v.value}${unit}${delta != null ? `, ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} vs ${prev!.label}` : ""}`} className="outline-none">
            <title>{`${v.label}: ${v.value}${unit}`}</title>
            {/* leaf-shaped marker */}
            <path
              d={`M${x(v.i)},${y(v.value) - 7} C${x(v.i) + 7},${y(v.value) - 7} ${x(v.i) + 7},${y(v.value)} ${x(v.i)},${y(v.value) + 7} C${x(v.i) - 7},${y(v.value) + 7} ${x(v.i) - 7},${y(v.value)} ${x(v.i)},${y(v.value) - 7}Z`}
              fill="#FFFFFF"
              stroke="#0F766E"
              strokeWidth="2.5"
            />
            {delta != null && Math.abs(delta) >= 0.01 && (
              <text x={x(v.i)} y={y(v.value) - 13} textAnchor="middle" fontSize="14" fontWeight="700" fill={delta >= 0 ? "#0B5D56" : "#B42E2E"} className="tnum">
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(1)}
              </text>
            )}
          </g>
        );
      })}
      {best && valid.length > 1 && (
        <text x={x(best.i)} y={pad.t - 12} textAnchor="middle" fontSize="14" fontWeight="700" fill="#7A5600">
          ★ best
        </text>
      )}
    </svg>
  );
}

// ───────────── Paired bars (MSE vs SEE %) ─────────────
export function PairedBars({ rows, aLabel = "MSE", bLabel = "SEE" }: { rows: { label: string; a: number | null; b: number | null }[]; aLabel?: string; bLabel?: string }) {
  const H = 200;
  const barW = 14;
  const groupW = 52;
  const W = Math.max(320, rows.length * groupW + 40);
  const y = (v: number) => 14 + (1 - v / 100) * (H - 44);
  return (
    <div>
      <div className="mb-2 flex gap-4 text-small text-ink-700">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-pine-600" />{aLabel} %</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-mint-400" />{bLabel} %</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="min-w-full" role="img" aria-label={`${aLabel} versus ${bLabel} by subject`}>
          {[0, 50, 100].map((t) => (
            <g key={t}>
              <line x1={28} x2={W} y1={y(t)} y2={y(t)} stroke={GRID} />
              <text x={22} y={y(t) + 4} textAnchor="end" fontSize="11" fill={AXIS}>{t}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const gx = 40 + i * groupW;
            return (
              <g key={r.label}>
                {[r.a, r.b].map((v, k) =>
                  v == null ? (
                    <text key={k} x={gx + k * (barW + 4) + barW / 2} y={H - 34} textAnchor="middle" fontSize="10" fill={AXIS}>n/a</text>
                  ) : (
                    <rect key={k} tabIndex={0} x={gx + k * (barW + 4)} y={y(v)} width={barW} height={H - 30 - y(v)} rx="5" fill={k ? "#34D399" : "#0F766E"} className="anim-grow-y outline-none" style={{ animationDelay: `${i * 40}ms` }} aria-label={`${r.label} ${k ? bLabel : aLabel} ${v}%`}>
                      <title>{`${r.label} · ${k ? bLabel : aLabel} ${v}%`}</title>
                    </rect>
                  ),
                )}
                <text x={gx + barW + 2} y={H - 12} textAnchor="middle" fontSize="11" fill={AXIS}>{r.label.length > 8 ? `${r.label.slice(0, 7)}…` : r.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ───────────── Subject Bloom ─────────────
export function SubjectBloom({ petals, size = 260 }: { petals: { label: string; value: number | null; href?: string }[]; size?: number }) {
  if (petals.length > 12) {
    return (
      <ul className="grid gap-2">
        {petals.map((p) => (
          <li key={p.label} className="flex items-center gap-3 text-small">
            <span className="w-28 truncate text-ink-700">{p.label}</span>
            <span className="h-2 flex-1 rounded-full bg-chart-track"><span className="block h-2 rounded-full" style={{ width: `${p.value ?? 0}%`, background: bloomColor(p.value) }} /></span>
            <span className="w-12 text-right tnum text-ink-900">{p.value == null ? "—" : `${p.value}%`}</span>
          </li>
        ))}
      </ul>
    );
  }
  const c = size / 2;
  const maxLen = size / 2 - 30;
  const n = Math.max(1, petals.length);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-auto w-full max-w-[300px]" role="img" aria-label={`Subject bloom: ${petals.map((p) => `${p.label} ${p.value ?? "no data"}`).join(", ")}`}>
      {[0.33, 0.66, 1].map((k) => (
        <circle key={k} cx={c} cy={c} r={14 + maxLen * k} fill="none" stroke={GRID} strokeDasharray="3 4" />
      ))}
      {petals.map((p, i) => {
        const ang = (i / n) * 360 - 90;
        const len = p.value == null ? 10 : 14 + (maxLen * p.value) / 100;
        const w = Math.min(26, (Math.PI * 2 * 40) / n / 1.4);
        const petal = `M0,0 C${w},-${len * 0.3} ${w * 0.8},-${len * 0.85} 0,-${len} C-${w * 0.8},-${len * 0.85} -${w},-${len * 0.3} 0,0Z`;
        const lx = c + Math.cos((ang * Math.PI) / 180) * (maxLen + 22);
        const ly = c + Math.sin((ang * Math.PI) / 180) * (maxLen + 22);
        const el = (
          <g transform={`translate(${c} ${c}) rotate(${ang + 90})`}>
            <path d={petal} fill={bloomColor(p.value)} fillOpacity={p.value == null ? 0.35 : 0.9} stroke="#FFFFFF" strokeWidth="1.5" className="anim-bloom" style={{ animationDelay: `${i * 60}ms` }} />
          </g>
        );
        return (
          <g key={p.label}>
            {p.href ? (
              <Link href={p.href} aria-label={`${p.label}: ${p.value == null ? "not enough data" : `${p.value}%`}`}>
                <title>{`${p.label}: ${p.value ?? "—"}%`}</title>
                {el}
              </Link>
            ) : (
              <g tabIndex={0} aria-label={`${p.label}: ${p.value == null ? "not enough data" : `${p.value}%`}`}>
                <title>{`${p.label}: ${p.value ?? "—"}%`}</title>
                {el}
              </g>
            )}
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={AXIS}>{p.label.length > 9 ? `${p.label.slice(0, 8)}…` : p.label}</text>
          </g>
        );
      })}
      <circle cx={c} cy={c} r="9" fill="#FBBF24" />
    </svg>
  );
}
export const bloomColor = (v: number | null) => (v == null ? "#CFD8CF" : v >= 75 ? "#34D399" : v >= 60 ? "#14B8A6" : v >= 50 ? "#8B7CF6" : "#FBBF24");

// ───────────── Credit Path ─────────────
export function CreditPath({ earned, inProgress, total }: { earned: number; inProgress: number; total: number | null }) {
  const t = total && total > 0 ? total : earned + inProgress;
  const remaining = Math.max(0, t - earned - inProgress);
  const seg = (v: number) => (t > 0 ? `${(v / t) * 100}%` : "0%");
  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-chart-track" role="img" aria-label={`Credits: ${earned} earned, ${inProgress} in progress, ${remaining} remaining`}>
        <span className="anim-grow-x h-full bg-pine-600" style={{ width: seg(earned) }} />
        <span className="anim-grow-x h-full bg-mint-400 [background-image:repeating-linear-gradient(45deg,transparent_0_6px,rgba(255,255,255,0.35)_6px_12px)]" style={{ width: seg(inProgress), animationDelay: "120ms" }} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-small">
        {[
          ["Earned", earned, "bg-pine-600"],
          ["In progress", inProgress, "bg-mint-400"],
          ["Remaining", total ? remaining : "—", "bg-chart-track border border-line"],
        ].map(([k, v, cls]) => (
          <div key={k as string}>
            <dt className="flex items-center gap-1.5 text-ink-500"><span aria-hidden className={cn("size-2.5 rounded-full", cls as string)} />{k}</dt>
            <dd className="font-display text-h3 font-bold text-ink-900 tnum">{v as React.ReactNode}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ───────────── Pulse Strip ─────────────
const MOOD = [
  { label: "No check-in", bg: "bg-canvas-sunk", text: "text-ink-500", glyph: "·" },
  { label: "Rough", bg: "bg-coral-100", text: "text-coral-700", glyph: "1" },
  { label: "Low", bg: "bg-butter-100", text: "text-butter-800", glyph: "2" },
  { label: "Okay", bg: "bg-sky-100", text: "text-sky-700", glyph: "3" },
  { label: "Good", bg: "bg-mint-100", text: "text-pine-700", glyph: "4" },
  { label: "Great", bg: "bg-pine-600", text: "text-white", glyph: "5" },
];
export function PulseStrip({
  weeks,
  compact,
}: {
  weeks: { week_start: string; mood: number | null; workload?: string | null; has_note?: boolean }[];
  compact?: boolean;
}) {
  return (
    <ol className={cn("grid grid-cols-12", compact ? "gap-0.5" : "gap-1")} aria-label="Weekly pulse, last 12 weeks">
      {weeks.map((w) => {
        const m = MOOD[w.mood ?? 0];
        const label = `Week of ${w.week_start}: ${m.label}${w.workload ? `, workload ${w.workload.toLowerCase()}` : ""}${w.has_note ? ", note shared" : ""}`;
        return (
          <li
            key={w.week_start}
            title={label}
            aria-label={label}
            className={cn(
              "relative flex items-center justify-center rounded-[6px] font-semibold tnum",
              compact ? "h-5 text-[10px]" : "h-9 text-label",
              m.bg,
              m.text,
            )}
          >
            {m.glyph}
            {w.workload === "HEAVY" && !compact && <span aria-hidden className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-coral-600" />}
            {w.has_note && !compact && <span aria-hidden className="absolute bottom-0.5 left-0.5 size-1.5 rounded-full bg-lilac-600" />}
          </li>
        );
      })}
    </ol>
  );
}
export const PULSE_LEGEND = MOOD;

// ───────────── Goal Compass ─────────────
export function GoalCompass({ current, required, max, state }: { current: number | null; required: number | null; max: number; state: string }) {
  const W = 260;
  const c = { x: W / 2, y: 130 };
  const r = 104;
  const pt = (v: number) => {
    const a = Math.PI * (1 - Math.min(Math.max(v, 0), max) / max);
    return { x: c.x + r * Math.cos(a), y: c.y - r * Math.sin(a) };
  };
  const arc = (v: number) => {
    const p = pt(v);
    return `M${c.x - r},${c.y} A${r},${r} 0 0 1 ${p.x},${p.y}`;
  };
  const tone = state === "NOT_REACHABLE" ? "#F06A6A" : state === "STRETCH" ? "#FBBF24" : "#34D399";
  return (
    <svg viewBox={`0 0 ${W} 150`} className="mx-auto h-auto w-full max-w-[320px]" role="img" aria-label={`Goal compass: current ${fmt(current)}, needed ${fmt(required)} of ${max}`}>
      <path d={`M${c.x - r},${c.y} A${r},${r} 0 0 1 ${c.x + r},${c.y}`} fill="none" stroke={TRACK} strokeWidth="18" strokeLinecap="round" />
      {required != null && <path d={arc(required)} fill="none" stroke={tone} strokeWidth="18" strokeLinecap="round" pathLength={1} className="anim-draw" />}
      {current != null && (() => {
        const p = pt(current);
        return (
          <g>
            <line x1={c.x} y1={c.y} x2={p.x} y2={p.y} stroke="#0F766E" strokeWidth="4" strokeLinecap="round" />
            <circle cx={p.x} cy={p.y} r="6" fill="#0F766E" />
          </g>
        );
      })()}
      <circle cx={c.x} cy={c.y} r="9" fill="#0F766E" />
      <text x={c.x - r} y={c.y + 18} textAnchor="middle" fontSize="11" fill={AXIS}>0</text>
      <text x={c.x + r} y={c.y + 18} textAnchor="middle" fontSize="11" fill={AXIS}>{max}</text>
    </svg>
  );
}

// ───────────── Small multiples ─────────────
export function Sparkline({ values, width = 96, height = 28, label }: { values: (number | null)[]; width?: number; height?: number; label: string }) {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 2) return <span className="text-small text-ink-500">—</span>;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const pts = v.map((y, i) => ({ x: 2 + (i * (width - 4)) / (v.length - 1), y: 3 + (1 - (y - lo) / Math.max(0.01, hi - lo)) * (height - 6) }));
  return (
    <svg width={width} height={height} role="img" aria-label={label}>
      <path d={smoothPath(pts)} fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" />
      <circle cx={pts.at(-1)!.x} cy={pts.at(-1)!.y} r="2.5" fill="#34D399" />
    </svg>
  );
}

export function CoverageDonut({ value, size = 132, onPine }: { value: number; size?: number; onPine?: boolean }) {
  const r = size / 2 - 10;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Coverage ${v}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={onPine ? "rgba(255,255,255,0.18)" : TRACK} strokeWidth="14" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={onPine ? "#6EE7B7" : "#0F766E"} strokeWidth="14" strokeLinecap="round" pathLength={100} strokeDasharray={`${v} 100`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="font-display" fontSize={size * 0.22} fontWeight="700" fill={onPine ? "#FFFFFF" : "#10201B"}>{Math.round(v)}%</text>
    </svg>
  );
}

export function HBars({ rows, max, unit = "", tone = "pine" }: { rows: { label: string; value: number; sub?: string; href?: string }[]; max?: number; unit?: string; tone?: "pine" | "lilac" | "mint" }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  const colors = { pine: "bg-pine-600", lilac: "bg-lilac-500", mint: "bg-mint-400" };
  return (
    <ul className="grid gap-3">
      {rows.map((r) => {
        const over = r.value > m;
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-2 text-small">
              <span className="truncate font-semibold text-ink-900">{r.label}</span>
              <span className={cn("tnum", over ? "font-semibold text-coral-700" : "text-ink-700")}>
                {r.value}
                {unit}
                {r.sub && <span className="text-ink-500"> {r.sub}</span>}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-chart-track">
              <div className={cn("anim-grow-x h-full rounded-full", over ? "bg-coral-600" : colors[tone])} style={{ width: `${Math.min(100, (r.value / m) * 100)}%` }} />
            </div>
          </>
        );
        return <li key={r.label}>{r.href ? <Link href={r.href} className="block rounded-control p-1 -m-1 hover:bg-canvas-sunk">{inner}</Link> : inner}</li>;
      })}
    </ul>
  );
}

export function GroupedBars({ groups, series }: { groups: { label: string; values: (number | null)[] }[]; series: string[] }) {
  const H = 200;
  const bw = 16;
  const gw = series.length * (bw + 4) + 24;
  const W = Math.max(300, groups.length * gw + 40);
  const all = groups.flatMap((g) => g.values.filter((v): v is number => v != null));
  const hi = Math.max(10, ...all);
  const y = (v: number) => 12 + (1 - v / hi) * (H - 40);
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-small text-ink-700">
        {series.map((s, i) => (
          <span key={s} className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} />{s}</span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="min-w-full" role="img" aria-label="Grouped bar chart">
          {groups.map((g, gi) => (
            <g key={g.label}>
              {g.values.map((v, si) =>
                v == null ? null : (
                  <rect key={si} x={36 + gi * gw + si * (bw + 4)} y={y(v)} width={bw} height={H - 28 - y(v)} rx="5" fill={SERIES[si % SERIES.length]} className="anim-grow-y">
                    <title>{`${g.label} · ${series[si]}: ${v}`}</title>
                  </rect>
                ),
              )}
              <text x={36 + gi * gw + (series.length * (bw + 4)) / 2} y={H - 10} textAnchor="middle" fontSize="11" fill={AXIS}>{g.label}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function StackedBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-chart-track" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}>
        {segments.map((s) => (
          <span key={s.label} className="anim-grow-x h-full" style={{ width: total ? `${(s.value / total) * 100}%` : 0, background: s.color }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-700">
        {segments.map((s) => (
          <li key={s.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />
            {s.label} <span className="font-semibold text-ink-900 tnum">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProgressRing({ value, size = 44, stroke = 5, label }: { value: number; size?: number; stroke?: number; label: string }) {
  const r = (size - stroke) / 2;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} role="img" aria-label={`${label}: ${Math.round(v)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#0F766E" strokeWidth={stroke} strokeLinecap="round" pathLength={100} strokeDasharray={`${v} 100`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.26} fontWeight="700" fill="#10201B" className="tnum">{Math.round(v)}</text>
    </svg>
  );
}
