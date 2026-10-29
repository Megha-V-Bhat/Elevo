import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our custom type-scale tokens; otherwise it mistakes `text-body`
// for a colour and drops `text-white` when both appear.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["display-xl", "display-l", "display-m", "stat", "h3", "body", "small", "label"] }] } },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

const TINTS = ["bg-mint-50 text-pine-700", "bg-lilac-50 text-lilac-700", "bg-butter-50 text-butter-800", "bg-sky-100 text-sky-700", "bg-coral-50 text-coral-700"];
/** Deterministic avatar tint so a person always gets the same colour. */
export const tintFor = (seed: string) => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
};

export const fmt = (n: number | null | undefined, dp = 2) =>
  n == null || Number.isNaN(n) ? "—" : Number(n).toFixed(dp).replace(/\.?0+$/, (m) => (dp > 0 && m.startsWith(".") ? "" : m));

export const greeting = (d = new Date()) => {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(d));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

/** Name for a greeting: "Ananya Rao" → "Ananya", "Dr. Meera Iyer" → "Dr. Iyer" (a title alone isn't a name). */
export const firstName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1 && /^(dr|prof|mr|mrs|ms)\.?$/i.test(parts[0])) return `${parts[0]} ${parts.at(-1)}`;
  return parts[0] || name;
};

export const toNum = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));
