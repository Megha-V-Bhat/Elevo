# PROGRESS.md

## Latest (30 Oct 2026)
- **Live:** https://elevo-woad.vercel.app (Vercel, functions in `syd1` next to the Sydney Supabase project, Fluid compute on). Code at https://github.com/Megha-V-Bhat/Elevo.
- Signed-in journeys (`tests/e2e/journeys.spec.ts`) run against the live site: 7/7 ✓, covering 61 pages for all three roles, Pulse check-in, planner save, Ask → mentor inbox, PDFs, all 15 exports and role boundaries. They found and fixed two production-only bugs: pdfkit's standard fonts weren't traced into the PDF/export functions, and notification grouping differed between the UTC server and the IST browser (hydration error #418).
- Performance: database time is ~150–200 ms per page (20–60 ms per query); the rest is the India ↔ Sydney distance and cold starts. Fixes: `syd1` region, Fluid compute, `staleTimes.dynamic = 30` (repeat navigation ~60 ms), Dock/tab-bar prefetch to the loading skeleton. `PERF_LOG=1` logs every Supabase call with its timing. Moving the database to Mumbai (ap-south-1) would cut a further ~150–250 ms per request.
- Manual follow-ups: add the Vercel URL to Supabase → Authentication → URL Configuration; set `RESEND_API_KEY`; optionally connect GitHub in Vercel for deploy-on-push.

## 27 Oct 2026
- Built in Claude Code (not Antigravity), following the Elevo spec with the fixes from the pre-build review.
- Phases 0–8 implemented; Phase 9's code parts are done (seeds, docs, templates, smoke tests). The deployment steps are manual (DEPLOY.md).
- Gates: `typecheck` ✓ · `lint` ✓ · `test` 195 ✓ (engines 72, guards 72+, PDF 3, RLS 45) · `build` ✓ · `test:e2e` public 33 ✓ (390/834/1440, axe clean).
- **Needs a live project:** no Supabase project was connected while building, so signed-in flows, Storage, Realtime, email and cron haven't run against a real backend. The database logic itself was executed: the migrations and RLS run on PGlite, a real Postgres engine. Start with `pnpm db:push && pnpm db:seed && pnpm db:demo`, then run `tests/e2e/roles.spec.ts` with `E2E_*` env set.
- Next: connect Supabase dev → run the role journeys → screenshot each role dashboard at 3 viewports → polish → deploy.

## Phases
| Phase | Status |
|---|---|
| 0 Setup, planning, styleguide | ✅ |
| 1 Brand, design system, shell, landing, illustrations | ✅ (illustrations hand-built SVG) |
| 2 Schema, RLS, storage, auth, roles, setup wizard, account | ✅ code · ~ live verification |
| 3 Academic records, grading, verification, corrections | ✅ code · ~ live |
| 4 Assignments & HOD administration | ✅ code · ~ live |
| 5 Mentoring, resources, sessions, journey, Ask | ✅ code · ~ live |
| 6 Insights, risk, Pulse, Planner, analytics | ✅ code · ~ live |
| 7 PDF, notifications, reminders, imports, exports, audit | ✅ code · ~ live |
| 8 Responsive/a11y/perf/security polish | partly (see below) |
| 9 Demo data, deploy, handover | code ✅ · deploy is manual |

## Decisions (one line each)
- Next.js 15.5 (stable, well understood) rather than 16.
- Charts are custom SVG, so Recharts was dropped to keep client JS low.
- `app.user_role()` replaces `app.current_role()`, which would shadow a reserved SQL function.
- Column-level rules use guard triggers, because RLS is row-level only.
- Grading includes IA components; weights are renormalised per subject.
- Pulse reminders are set by day (Vercel Hobby cron is once a day at an imprecise time); "today" is IST (`app.today()`).
- Contrast-driven token changes: text-on-tint tokens, a darker Sunrise end, coral-700 for destructive. Measured values are in DESIGN.md.
- `tailwind-merge` is extended with the custom type scale. Without it, `text-body` silently removed `text-white` from buttons (caught by screenshot).
- `app.is_service()` trusts the JWT role only. Anonymous callers lose EXECUTE on every RPC (caught while writing the seed; regression-tested).
- HOD-imported results land as VERIFIED (exam-cell data is authoritative); subject/result imports are all-or-nothing.
- A student-scoped global semester switcher (UXP-01) became per-page semester chips.

## Known gaps / proposals
- UXP-08 first-visit coach marks: not built.
- Performance budget: most routes are ~105 kB first-load JS. Heavier ones are `/notifications` (~258 kB), `/setup` (~232 kB), `/hod/assignments` (~216 kB) and pages with composer sheets (~200–207 kB), so the 180 kB target isn't met everywhere. Next steps: lazy-load sheets and the notification panel, and split the Supabase browser client from the bell.
- Lighthouse hasn't been run against the deployed URL yet.
- Immediate events (new feedback, replies) notify in-app with Realtime; email is used for the daily reminders. A per-event email option could come later.
- The HOD can change roles, so the "HOD aggregates only" boundary is a policy, not cryptography. Role changes are audited.

## LOOP_LOG
| Slice | Gates | Notes |
|---|---|---|
| Engines | 72 unit ✓ first run | — |
| Schema + RLS | 38/39 → 39 ✓ | test fixed (thread already ANSWERED) |
| IST date fix | ✓ | Monday 00:00–05:30 IST check-ins were rejected under UTC |
| Guard test | 2 false positives → ✓ | type-only imports; copy wording |
| PDF | 3 ✓ | text extraction joins glyph runs |
| Visual review | buttons had no white text → fixed | tailwind-merge custom tokens |
| Contrast | 3 failures → fixed | hero text opacity, gradient end, destructive |
| Axe e2e | 6 → 33 ✓ | aria-hidden focusables, opacity on chip text |
| Security | anon RPC hole → fixed, +3 tests | is_service + revoke |
| Deploy (Vercel) | journeys 5/7 → 7/7 ✓ | pdfkit fonts traced; IST notification grouping; ask rate limit reset in test cleanup |
| Performance | avg page 1.3 s → repeat nav ~60 ms | syd1, Fluid, router cache, nav prefetch; `-0.0` trend label fixed |
