# DESIGN.md — Meadow Light

Fresh, calm, optimistic growth. A crisp near-white canvas, deep pine for confidence and action, fresh mint for progress, lilac and butter as friendly accents. Big characterful grotesque display type, bento layouts of softly tinted cards with fine borders, navigation that floats in a dock. Data visuals borrow from growth in nature. Rich through craft, colour and graphics — never clutter. Live reference: `/styleguide` (dev).

## Tokens (`src/app/globals.css`, Tailwind v4 `@theme`)

| Group | Tokens |
|---|---|
| Neutrals | canvas `#FAFBF8` · canvas-sunk `#F1F5F0` · surface `#FFFFFF` · line `#E3E8E2` · line-strong `#CFD8CF` |
| Ink | ink-900 `#10201B` · ink-700 `#34433E` · ink-500 `#5E6B66` · **ink-450 `#6B7772`** (text-safe muted: axis labels, placeholders) · ink-400 `#8D9893` (decorative only) |
| Brand | pine-800 `#0B4F4A` · pine-700 `#0B5D56` · pine-600 `#0F766E` · pine-100 · pine-50 · teal-500 `#14B8A6` · mint-500/400/300/100/50 |
| Accents | lilac-700 `#5B47D6` (text on lilac) · lilac-600/500/100/50 · butter-800 `#7A5600` (text on butter) · butter-500/400/300/100/50 · sky-700 `#0369A1` (text on sky) · sky-500/100 · coral-700 `#B42E2E` (text on coral, destructive) · coral-600/500/100/50 |
| Charts | series `#0F766E #34D399 #8B7CF6 #FBBF24 #0EA5E9 #F06A6A #14B8A6`; track `#EEF2ED`; grid `#EDF1EC`; area pine 22%→0% |
| Radius | hero 28 · card 20 · panel 14 · control 12 · dock 24 · avatar 16 · chips 999 |
| Shadows | shadow-1 hairline · shadow-2 soft green lift · shadow-dock · shadow-hero |
| Motion | 140 / 220 / 360 / 700 ms, `cubic-bezier(0.22,1,0.36,1)`; all off under `prefers-reduced-motion` |

### Deviations from the original brief (deliberate, for WCAG 2.2 AA)
- **Text-on-tint tokens added** (lilac-700, butter-800, sky-700, coral-700, ink-450). The brief's pairs (e.g. lilac-600 on lilac-100 4.1:1, coral-600 on coral-100 3.4:1, ink-400 axis text 3.0:1, mint/sky/butter icons on their tints ≤ 2.4:1) failed.
- **Sunrise gradient** is `#0B4F4A → #0F766E (55%) → #0F7F75`. The brief's light end (`#6EE7B7`) gave white text 1.5:1. Mint now lives in the decorative glow and the graphics. All hero text is solid white.
- **Destructive buttons** use coral-700 (white 6.2:1); coral-600 gave 4.1:1.

### Measured contrast (text pairs in use)

| Pair | Ratio |
|---|---|
| ink-900 on canvas | 16.2 |
| ink-700 on surface | 10.4 |
| ink-500 on canvas / canvas-sunk | 5.4 / 5.1 |
| ink-450 on surface | 4.7 |
| white on pine-600 · pine-800 · Sunrise end | 5.5 · 9.4 · 4.9 |
| pine-700 on mint-100 · pine-50 | 6.7 · 7.1 |
| lilac-700 on lilac-100 | 5.3 |
| butter-800 on butter-100 · butter-50 | 6.0 · 6.4 |
| coral-700 on coral-100 · surface | 5.2 · 6.2 |
| sky-700 on sky-100 | 5.2 |

Axe (WCAG 2.2 AA) runs in `tests/e2e/public.spec.ts` with zero serious/critical findings allowed.

## Typography
Bricolage Grotesque (variable, opsz) for display: page titles, hero numbers, stats. Manrope 400–700 for UI and body. `tnum` utility on every aligned number. Scale: display-xl 56/60 · display-l 40/44 · display-m 30/36 · stat 44/48 · h3 20/28 · body 15/24 · small 13/20 · label 12/16 uppercase.

## Layout & navigation
- **Desktop/tablet:** 64px top bar (logo · ⌘K search · Ask shortcut · bell · avatar). Primary nav is the floating **Dock** (6 destinations + "More" popover); the active item morphs into a pine pill with its label (`layoutId`). Content has 120px bottom padding.
- **Mobile:** compact top bar; bottom tab bar (3 destinations + raised centre "+" Quick Actions + "More" sheet); bottom sheets replace dialogs; tables become cards.
- **Toasts** sit top-centre so they never collide with the Dock.
- **Mentee profile:** sticky Identity Column + chip Tab Strip with the mint "sprout" underline.

## Signature visuals (`src/components/charts`)
Growth Rings (CGPA; one ring per semester, thickness ∝ credits, colour = SGPA band) · Subject Bloom (petals = subject %, list fallback > 12) · Trend Line (leaf markers, delta labels, ★ best) · Paired Bars (MSE vs SEE %, n/a when not comparable) · Credit Path · Stepping Stones · Pulse Strip (number + colour, never colour only) · Goal Compass · Workload bars · Coverage donut · Grouped/Stacked bars · Sparkline · Progress ring. All are server-rendered SVG with CSS "grow" animation and a native `<details>` "View as table".

## Illustrations
Paper-cut layered scenes hand-built in SVG (`src/components/illustrations`) — the brief's fallback when image generation isn't available. Same palette and soft layer shadows; 23 scenes covering hero, login, onboarding steps, every empty state, 404/500/offline and the celebration.

## Components
Button (primary/secondary/tonal/ghost/destructive/link), Field + Input/Textarea/Select, Switch, Segmented, TagInput, Chip, StatusPill, DeltaChip, Meter, Avatar (deterministic tint, ring for self), Card/CardHeader/IconTile, StatTile, HeroCard, NextStepCard, EmptyState, ErrorState, Skeleton, TabStrip, BottomSheet, CommandPalette, NotificationBell/List, AvatarUploader (crop + camera), FileDropzone (resource uploader), AssignmentBoard.

## Rubric
Screens are reviewed at 390 / 834 / 1440 against the 10-point Rubric v3 (identity, hierarchy, typography, colour, graphics, spacing, motion, states, responsiveness, accessibility). See PROGRESS.md for what has been reviewed visually.
