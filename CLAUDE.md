# Elevo — working rules

Sources of truth: FEATURES.md (what), DESIGN.md (look), ARCHITECTURE.md (how), PROGRESS.md (where we are). Read only the section you need.

## Product rules (non-negotiable)
1. Real data only — no mock arrays in app pages (the `/styleguide` and landing composition are the only sample props).
2. Authorization lives in Postgres (RLS + guard triggers + definer functions) AND in server guards (`src/server/authz.ts`). Never UI-only.
3. Mentors see only ACTIVE assigned mentees, on every surface (pages, actions, routes, files, PDFs, Pulse, Ask, plans).
4. Roles change only through the HOD flow; never read a role from anything the client controls.
5. Students never see rankings or other students' data; comparisons are with their own past/targets only.
6. Charts, insights, risk flags, Pulse, planner results and Ask threads never go into PDFs or exports.
7. Derived values only when inputs exist; otherwise "Not enough data" with the reason.
8. Verified/finalized records change only via an approved correction. Important changes are audited.
9. Out of scope: in-product AI, low-bandwidth toggle, constellation graph, rank lists, attendance, dark mode.

## Engineering
- Server actions: `"use server"`, wrap in `handle()`, call `requireUser/requireRole/assert*` first (enforced by `tests/unit/server-action-guards.test.ts`), validate with zod.
- Service role only in `src/server/admin/*`; helpers that bypass checks must not live in a `"use server"` file.
- Multi-row writes → Postgres functions. New SQL → a new migration file + tests in `tests/rls`.
- Design: tokens only (globals.css `@theme`), Bricolage for display, Manrope for UI, tabular numbers, 44px targets, every chart in `ChartFrame` (table alternative). Keep text contrast ≥ 4.5:1 (measure, don't guess).
- Gates before committing: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, plus `pnpm test:e2e` for UI changes.
