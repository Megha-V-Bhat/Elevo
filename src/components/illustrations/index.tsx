import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Paper-cut layered illustrations, hand-built as SVG (image generation fallback per DESIGN.md §2.7).
 * Each scene stacks flat paper shapes with a soft drop shadow between layers.
 * Palette: pine #0F766E, mint #34D399, lilac #8B7CF6, butter #FBBF24, canvas #FAFBF8.
 */

export type IllustrationName =
  | "hero"
  | "login"
  | "marks"
  | "feedback"
  | "resources"
  | "sessions"
  | "mentees"
  | "notifications"
  | "search"
  | "pulse"
  | "questions"
  | "plans"
  | "import-done"
  | "error"
  | "not-found"
  | "offline"
  | "celebrate"
  | "onboard-personal"
  | "onboard-academic"
  | "onboard-history"
  | "onboard-about"
  | "onboard-review"
  | "locked";

const C = {
  pine: "#0F766E",
  pineDeep: "#0B4F4A",
  teal: "#14B8A6",
  mint: "#34D399",
  mintLight: "#6EE7B7",
  mintPale: "#D6F6E8",
  lilac: "#8B7CF6",
  lilacPale: "#ECE9FE",
  butter: "#FBBF24",
  butterPale: "#FEF3C7",
  coral: "#F06A6A",
  paper: "#FFFFFF",
  canvas: "#F1F5F0",
  ink: "#34433E",
};

function Shadow({ id }: { id: string }) {
  return (
    <filter id={id} x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0B4F4A" floodOpacity="0.18" />
    </filter>
  );
}

/** Rolling paper hills + sun — the shared backdrop. */
function Backdrop({ f, sun = true, sunX = 178 }: { f: string; sun?: boolean; sunX?: number }) {
  return (
    <>
      <ellipse cx="120" cy="96" rx="104" ry="78" fill={C.canvas} />
      {sun && <circle cx={sunX} cy="46" r="16" fill={C.butter} filter={`url(#${f})`} />}
      <path d="M16 140 C56 104 92 112 124 126 C152 138 186 108 224 120 L224 164 L16 164 Z" fill={C.mintPale} filter={`url(#${f})`} />
      <path d="M16 150 C60 128 104 134 140 146 C176 158 200 140 224 142 L224 166 L16 166 Z" fill={C.mintLight} filter={`url(#${f})`} />
      <path d="M16 160 C80 148 160 150 224 158 L224 168 L16 168 Z" fill={C.pine} filter={`url(#${f})`} />
    </>
  );
}

function Sprout({ x, y, s = 1, f }: { x: number; y: number; s?: number; f: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} filter={`url(#${f})`}>
      <path d="M0 0 V-26" stroke={C.pine} strokeWidth="3" strokeLinecap="round" />
      <path d="M-1 -14 C-12 -14 -20 -22 -20 -34 C-8 -34 -1 -26 -1 -14Z" fill={C.teal} />
      <path d="M1 -22 C1 -31 7 -38 19 -38 C19 -28 12 -21 1 -22Z" fill={C.mint} />
    </g>
  );
}

function Figure({ x, y, body, s = 1, f }: { x: number; y: number; body: string; s?: number; f: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} filter={`url(#${f})`}>
      <path d="M-13 0 C-13 -22 -9 -34 0 -34 C9 -34 13 -22 13 0Z" fill={body} />
      <circle cx="0" cy="-42" r="8" fill="#F4C9A8" />
      <path d="M-8 -44 C-8 -52 8 -52 8 -44 C4 -48 -4 -48 -8 -44Z" fill={C.pineDeep} />
    </g>
  );
}

function Paper({ x, y, w = 56, h = 68, f, lines = 4, tint = C.paper, rot = 0 }: { x: number; y: number; w?: number; h?: number; f: string; lines?: number; tint?: string; rot?: number }) {
  return (
    <g transform={`rotate(${rot} ${x + w / 2} ${y + h / 2})`} filter={`url(#${f})`}>
      <rect x={x} y={y} width={w} height={h} rx="6" fill={tint} />
      {Array.from({ length: lines }, (_, i) => (
        <rect key={i} x={x + 9} y={y + 12 + i * 11} width={i % 2 ? w - 26 : w - 18} height="4" rx="2" fill={C.canvas} />
      ))}
    </g>
  );
}

const SCENES: Record<IllustrationName, (f: string) => React.ReactNode> = {
  hero: (f) => (
    <>
      <Backdrop f={f} sunX={190} />
      <path d="M40 166 C80 150 110 140 140 120 C160 106 176 90 186 70" stroke={C.paper} strokeWidth="7" strokeLinecap="round" fill="none" strokeDasharray="1 13" />
      <Figure x={104} y={140} body={C.pine} s={1.15} f={f} />
      <Figure x={132} y={132} body={C.lilac} s={0.9} f={f} />
      <Sprout x={58} y={156} f={f} s={0.9} />
    </>
  ),
  login: (f) => (
    <>
      <Backdrop f={f} sunX={60} />
      <g filter={`url(#${f})`}>
        <rect x="118" y="70" width="70" height="78" rx="6" fill={C.paper} />
        <path d="M112 74 L153 46 L194 74Z" fill={C.pine} />
        <rect x="146" y="118" width="16" height="30" rx="3" fill={C.mintLight} />
        <rect x="128" y="84" width="14" height="14" rx="3" fill={C.lilacPale} />
        <rect x="164" y="84" width="14" height="14" rx="3" fill={C.lilacPale} />
      </g>
      <Sprout x={84} y={154} f={f} />
      <Sprout x={206} y={152} f={f} s={0.7} />
    </>
  ),
  marks: (f) => (
    <>
      <Backdrop f={f} />
      <Paper x={72} y={56} f={f} rot={-6} />
      <Paper x={110} y={50} f={f} tint={C.butterPale} rot={5} />
      <g filter={`url(#${f})`}>
        <circle cx="160" cy="112" r="18" fill={C.mint} />
        <path d="M151 112 l6 6 l12 -13" stroke={C.paper} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  ),
  feedback: (f) => (
    <>
      <Backdrop f={f} />
      <g filter={`url(#${f})`}>
        <rect x="62" y="54" width="84" height="48" rx="14" fill={C.paper} />
        <path d="M80 100 L74 114 L94 100Z" fill={C.paper} />
        <rect x="76" y="68" width="54" height="5" rx="2.5" fill={C.mintPale} />
        <rect x="76" y="80" width="38" height="5" rx="2.5" fill={C.mintPale} />
      </g>
      <g filter={`url(#${f})`}>
        <rect x="122" y="88" width="66" height="38" rx="12" fill={C.lilac} />
        <path d="M172 124 L180 136 L162 124Z" fill={C.lilac} />
      </g>
      <Sprout x={196} y={156} f={f} s={0.8} />
    </>
  ),
  resources: (f) => (
    <>
      <Backdrop f={f} />
      <g filter={`url(#${f})`}>
        <rect x="70" y="58" width="22" height="80" rx="4" fill={C.pine} />
        <rect x="94" y="66" width="20" height="72" rx="4" fill={C.lilac} />
        <rect x="116" y="52" width="24" height="86" rx="4" fill={C.butter} />
        <rect x="142" y="64" width="20" height="74" rx="4" transform="rotate(10 152 101)" fill={C.mint} />
      </g>
      <Sprout x={182} y={140} f={f} />
    </>
  ),
  sessions: (f) => (
    <>
      <Backdrop f={f} />
      <g filter={`url(#${f})`}>
        <rect x="70" y="50" width="100" height="84" rx="10" fill={C.paper} />
        <rect x="70" y="50" width="100" height="22" rx="10" fill={C.pine} />
        <rect x="70" y="62" width="100" height="10" fill={C.pine} />
        {[0, 1, 2, 3].map((c) =>
          [0, 1, 2].map((r) => (
            <rect key={`${c}${r}`} x={80 + c * 22} y={80 + r * 16} width="14" height="10" rx="3" fill={c === 2 && r === 1 ? C.butter : C.canvas} />
          )),
        )}
      </g>
    </>
  ),
  mentees: (f) => (
    <>
      <Backdrop f={f} />
      <Figure x={92} y={146} body={C.mint} s={0.85} f={f} />
      <Figure x={120} y={142} body={C.pine} s={1.05} f={f} />
      <Figure x={148} y={146} body={C.lilac} s={0.85} f={f} />
    </>
  ),
  notifications: (f) => (
    <>
      <Backdrop f={f} sun={false} />
      <g filter={`url(#${f})`}>
        <path d="M120 44 C98 44 90 62 90 80 L90 104 L80 118 L160 118 L150 104 L150 80 C150 62 142 44 120 44Z" fill={C.butter} />
        <circle cx="120" cy="126" r="9" fill={C.pine} />
      </g>
      <g filter={`url(#${f})`}>
        <path d="M160 52 q10 0 14 -10" stroke={C.pine} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M80 52 q-10 0 -14 -10" stroke={C.pine} strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
    </>
  ),
  search: (f) => (
    <>
      <Backdrop f={f} sun={false} />
      <g filter={`url(#${f})`}>
        <circle cx="110" cy="84" r="32" fill={C.paper} stroke={C.pine} strokeWidth="9" />
        <rect x="134" y="104" width="12" height="40" rx="6" transform="rotate(-42 140 124)" fill={C.pine} />
      </g>
      <Sprout x={110} y={98} s={0.55} f={f} />
    </>
  ),
  pulse: (f) => (
    <>
      <Backdrop f={f} />
      <g filter={`url(#${f})`}>
        <rect x="56" y="62" width="128" height="58" rx="14" fill={C.paper} />
        <path d="M68 92 h22 l8 -18 l12 34 l10 -26 l8 10 h44" stroke={C.mint} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  ),
  questions: (f) => (
    <>
      <Backdrop f={f} />
      <g filter={`url(#${f})`}>
        <rect x="66" y="50" width="92" height="64" rx="16" fill={C.lilac} />
        <path d="M86 112 L80 128 L104 112Z" fill={C.lilac} />
        <text x="112" y="96" textAnchor="middle" fontSize="40" fontWeight="800" fill={C.paper} fontFamily="sans-serif">?</text>
      </g>
      <Figure x={176} y={150} body={C.pine} s={0.8} f={f} />
    </>
  ),
  plans: (f) => (
    <>
      <Backdrop f={f} />
      <g filter={`url(#${f})`}>
        <path d="M60 126 A60 60 0 0 1 180 126" stroke={C.canvas} strokeWidth="18" fill="none" />
        <path d="M60 126 A60 60 0 0 1 150 74" stroke={C.mint} strokeWidth="18" fill="none" strokeLinecap="round" />
        <circle cx="120" cy="126" r="8" fill={C.pine} />
        <path d="M120 126 L156 90" stroke={C.pine} strokeWidth="5" strokeLinecap="round" />
      </g>
    </>
  ),
  "import-done": (f) => (
    <>
      <Backdrop f={f} />
      <Paper x={76} y={58} f={f} lines={5} />
      <g filter={`url(#${f})`}>
        <circle cx="142" cy="112" r="22" fill={C.pine} />
        <path d="M131 112 l8 8 l14 -16" stroke={C.paper} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  ),
  error: (f) => (
    <>
      <Backdrop f={f} sun={false} />
      <g filter={`url(#${f})`}>
        <path d="M120 46 L170 130 L70 130Z" fill={C.butter} strokeLinejoin="round" />
        <rect x="116" y="74" width="8" height="30" rx="4" fill={C.pineDeep} />
        <circle cx="120" cy="116" r="5" fill={C.pineDeep} />
      </g>
    </>
  ),
  "not-found": (f) => (
    <>
      <Backdrop f={f} />
      <g filter={`url(#${f})`}>
        <rect x="114" y="60" width="8" height="92" rx="3" fill={C.pineDeep} />
        <path d="M122 66 h52 l12 12 l-12 12 h-52Z" fill={C.paper} />
        <path d="M114 96 h-52 l-12 12 l12 12 h52Z" fill={C.lilac} />
      </g>
    </>
  ),
  offline: (f) => (
    <>
      <Backdrop f={f} sun={false} />
      <g filter={`url(#${f})`} stroke={C.pine} strokeWidth="8" fill="none" strokeLinecap="round">
        <path d="M78 86 A60 60 0 0 1 162 86" />
        <path d="M92 102 A40 40 0 0 1 148 102" />
        <circle cx="120" cy="120" r="4" fill={C.pine} />
        <path d="M76 140 L166 52" stroke={C.coral} />
      </g>
    </>
  ),
  celebrate: (f) => (
    <>
      <Backdrop f={f} />
      <Sprout x={120} y={150} s={2.2} f={f} />
      <g filter={`url(#${f})`}>
        <circle cx="80" cy="60" r="5" fill={C.lilac} />
        <circle cx="168" cy="72" r="4" fill={C.mint} />
        <rect x="150" y="40" width="8" height="8" rx="2" transform="rotate(20 154 44)" fill={C.lilac} />
        <rect x="64" y="96" width="8" height="8" rx="2" transform="rotate(-20 68 100)" fill={C.butter} />
      </g>
    </>
  ),
  "onboard-personal": (f) => (
    <>
      <Backdrop f={f} />
      <g filter={`url(#${f})`}>
        <rect x="74" y="52" width="92" height="70" rx="12" fill={C.paper} />
        <circle cx="100" cy="82" r="13" fill={C.mintLight} />
        <rect x="120" y="74" width="34" height="5" rx="2.5" fill={C.canvas} />
        <rect x="120" y="86" width="24" height="5" rx="2.5" fill={C.canvas} />
        <rect x="86" y="104" width="68" height="6" rx="3" fill={C.lilacPale} />
      </g>
    </>
  ),
  "onboard-academic": (f) => (
    <>
      <Backdrop f={f} />
      <g filter={`url(#${f})`}>
        <path d="M120 54 L176 78 L120 102 L64 78Z" fill={C.pine} />
        <path d="M86 88 V112 C100 124 140 124 154 112 V88 L120 102Z" fill={C.teal} />
        <path d="M170 80 V110" stroke={C.butter} strokeWidth="4" strokeLinecap="round" />
        <circle cx="170" cy="114" r="5" fill={C.butter} />
      </g>
    </>
  ),
  "onboard-history": (f) => (
    <>
      <Backdrop f={f} />
      <g filter={`url(#${f})`}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={74 + i * 24} y={128 - (i + 1) * 16} width="18" height={(i + 1) * 16} rx="4" fill={[C.mintLight, C.mint, C.teal, C.pine][i]} />
        ))}
      </g>
      <Sprout x={180} y={128} f={f} s={0.8} />
    </>
  ),
  "onboard-about": (f) => (
    <>
      <Backdrop f={f} />
      <g filter={`url(#${f})`}>
        <path d="M120 120 C80 96 70 70 90 58 C104 50 116 60 120 70 C124 60 136 50 150 58 C170 70 160 96 120 120Z" fill={C.lilac} />
      </g>
      <g filter={`url(#${f})`}>
        <circle cx="74" cy="58" r="6" fill={C.butter} />
        <circle cx="170" cy="100" r="5" fill={C.mint} />
      </g>
    </>
  ),
  "onboard-review": (f) => (
    <>
      <Backdrop f={f} />
      <Paper x={80} y={50} w={80} h={84} f={f} lines={5} />
      <g filter={`url(#${f})`}>
        <circle cx="158" cy="126" r="16" fill={C.mint} />
        <path d="M150 126 l6 6 l10 -12" stroke={C.paper} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  ),
  locked: (f) => (
    <>
      <Backdrop f={f} sun={false} />
      <g filter={`url(#${f})`}>
        <path d="M98 84 V70 a22 22 0 0 1 44 0 V84" stroke={C.pine} strokeWidth="9" fill="none" />
        <rect x="86" y="82" width="68" height="54" rx="10" fill={C.butter} />
        <circle cx="120" cy="106" r="7" fill={C.pineDeep} />
        <rect x="117" y="108" width="6" height="14" rx="3" fill={C.pineDeep} />
      </g>
    </>
  ),
};

export const ILLUSTRATION_ALT: Record<IllustrationName, string> = {
  hero: "Two figures walking a hill path toward a sunrise",
  login: "A small campus building in a garden",
  marks: "Mark sheets with a green tick",
  feedback: "Two speech bubbles",
  resources: "A row of books with a sprout",
  sessions: "A calendar with one day highlighted",
  mentees: "Three people standing together",
  notifications: "A ringing bell",
  search: "A magnifying glass over a sprout",
  pulse: "A gentle heartbeat line",
  questions: "A speech bubble with a question mark",
  plans: "A gauge pointing toward a goal",
  "import-done": "A document with a completed check",
  error: "A warning sign",
  "not-found": "A signpost pointing two ways",
  offline: "A Wi-Fi symbol crossed out",
  celebrate: "A sprout in bloom with confetti",
  "onboard-personal": "A profile card",
  "onboard-academic": "A graduation cap",
  "onboard-history": "Rising bars with a sprout",
  "onboard-about": "A heart",
  "onboard-review": "A completed form",
  locked: "A padlock",
};

export function Illustration({ name, className, decorative = true }: { name: IllustrationName; className?: string; decorative?: boolean }) {
  const f = `pc-${name}`;
  return (
    <svg
      viewBox="0 0 240 180"
      className={cn("h-40 w-auto", className)}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : ILLUSTRATION_ALT[name]}
    >
      <defs>
        <Shadow id={f} />
      </defs>
      {SCENES[name](f)}
    </svg>
  );
}
