import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

export const firstName = (name: string) => name.split(/\s+/)[0] || name;

export const toNum = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));
