import { cn } from "@/lib/utils";

const MOUTHS = ["", "M10 22 Q16 16 22 22", "M10 21 Q16 18 22 21", "M10 20 H22", "M10 19 Q16 23 22 19", "M9 18 Q16 26 23 18"];
const FILL = ["", "#FDE4E1", "#FEF3C7", "#E0F2FE", "#D6F6E8", "#0F766E"];
const INK = ["", "#B42E2E", "#7A5600", "#0369A1", "#0B5D56", "#FFFFFF"];
export const MOOD_TEXT = ["", "Rough", "Low", "Okay", "Good", "Great"];

/** Illustrated mood faces (SVG, not emoji). Always paired with a text label. */
export function MoodFace({ mood, size = 40, className }: { mood: number; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className={cn("shrink-0", className)}>
      <circle cx="16" cy="16" r="15" fill={FILL[mood]} />
      <circle cx="11.5" cy="13" r="1.8" fill={INK[mood]} />
      <circle cx="20.5" cy="13" r="1.8" fill={INK[mood]} />
      <path d={MOUTHS[mood]} stroke={INK[mood]} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
