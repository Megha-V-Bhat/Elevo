# Elevo

**Mentoring that grows with you.** A full-stack academic mentoring platform for college departments, with three roles — **Mentee** (student), **Mentor** (faculty) and **HOD** (administrator).

- Semester-wise academic records with configurable grading, verification and audited corrections
- Transparent, rule-based insights and risk indicators with "Why am I seeing this?" evidence
- Recommendations, goals and improvement plans, study resources, mentoring sessions, a Stepping-Stones journey timeline
- **Weekly Pulse** (30-second check-in), **Ask My Mentor** (private question threads), **Grade Goal Planner** (what-if targets)
- HOD Assignment Board (drag and drop, keyboard accessible, Undo), directories, analytics, interventions, bulk import, exports and audit history
- Professional PDF reports built from verified records only
- Meadow Light design system: Bricolage Grotesque + Manrope, pine/mint with lilac and butter, floating Dock, paper-cut illustrations, signature SVG visuals

Docs: [DESIGN.md](DESIGN.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [FEATURES.md](FEATURES.md) · [PROGRESS.md](PROGRESS.md) · [DEPLOY.md](DEPLOY.md) · [USER_GUIDE.md](USER_GUIDE.md)

## Stack

Next.js 15 (App Router, RSC, Server Actions) · TypeScript strict · Tailwind CSS v4 · Radix primitives · Motion · dnd-kit · cmdk · zod · Supabase (Postgres + RLS, Auth, Storage, Realtime) · @react-pdf/renderer · papaparse + exceljs · Resend · Vercel Cron · Vitest · PGlite (in-process Postgres for RLS tests) · Playwright + axe.

## Setup

1. **Tools:** Node 20+ and pnpm (`npm i -g pnpm`). The Supabase CLI is a dev dependency (`pnpm supabase …`) — a global npm install isn't supported.
2. **Install:** `pnpm install`
3. **Supabase:** create `elevo-dev` (and later `elevo-prod`). In the dashboard: turn **off** "Allow new users to sign up", keep email confirmation on, set Site URL `http://localhost:3000` and redirect `http://localhost:3000/**`, and configure custom SMTP with Resend.
4. **Secrets:** `cp .env.example .env.local` and fill it in. `pnpm check:env` lists missing names (never values). Never commit `.env.local`.
5. **Database:**
   ```bash
   pnpm supabase login            # once, uses your access token
   pnpm supabase link --project-ref <SUPABASE_PROJECT_REF>
   pnpm db:push                   # applies supabase/migrations
   pnpm db:seed                   # department, grading scheme, thresholds, first HOD
   pnpm db:demo                   # optional realistic demo data → DEMO.md
   ```
6. **Email templates:** paste `supabase/templates/*.html` into Supabase → Authentication → Emails → Templates (subjects in `supabase/templates/SUBJECTS.md`).
7. **Run:** `pnpm dev` → http://localhost:3000. Sign in with `SEED_HOD_EMAIL` and finish the setup wizard.

Without Supabase keys the public pages and `/styleguide` still render; app routes show a "connect your database" notice.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm typecheck` · `pnpm lint` | TypeScript and ESLint |
| `pnpm test` | All Vitest suites (engines, PDF, server-action guards, RLS) |
| `pnpm test:unit` · `pnpm test:rls` | Engines/PDF/guards only · Postgres RLS suite on PGlite |
| `pnpm test:e2e` | Playwright at 390 / 834 / 1440 with axe (role journeys need `E2E_*` env, see `tests/e2e/roles.spec.ts`) |
| `pnpm db:push` · `db:types` · `db:seed` · `db:demo` | Supabase migrations, types, seeds |
| `pnpm check:env` · `build:emails` | Env check · regenerate email templates |

## Security model (short)

Access is enforced in Postgres: RLS on every table, `SECURITY DEFINER` helpers (`app.user_role()`, `app.is_hod()`, `app.is_active_mentor_of()`), column-guard triggers for fields RLS can't protect, and transactional workflow functions. Every server action and route handler re-checks the caller (`src/server/authz.ts`), and a unit test fails the build if any exported server action skips that check. The service-role key is only used under `src/server/admin/*` after a HOD/system check. Details in [ARCHITECTURE.md](ARCHITECTURE.md).
