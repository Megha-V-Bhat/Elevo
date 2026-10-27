# ARCHITECTURE.md

## Overview
A Next.js App Router monolith on Vercel with a strict server layer, backed by Supabase (Postgres, Auth, Storage, Realtime).

```
src/app/(public)        landing, login, forgot/reset, accept-invite, suspended, 403, offline
src/app/(onboarding)    /setup wizard
src/app/(app)           mentee/*, mentor/*, hod/*, account, notifications  (shell: TopBar + Dock + MobileTabBar)
src/app/api             reports/student/[id] (PDF), exports/[kind], imports/template, files, sessions/[id]/ics, cron/daily
src/app/auth/confirm    email-link verification (invite, recovery)
src/server              supabase.ts (per-request user client) · authz.ts (guards) · result.ts (handle/AppError)
src/server/actions      "use server" actions per domain (all guarded; test-enforced)
src/server/admin        service-role code only: client, users (invites), imports, audit events, email, reminders, rate limit
src/server/queries      read models (academics loader + bulk loader, roster, mentoring, ask, pulse, hod, settings)
src/server/pdf          StudentReport (react-pdf), table report, report-data builder
src/lib/engine          pure engines: grading, insights, risk, pulse, planner (exhaustively unit-tested)
src/components          ui · charts · illustrations · shell · brand · feedback
src/features            domain UI (academics, insights, pulse, ask, planner, mentoring, mentor, hod, profile, journey, account)
supabase/migrations     0001 schema · 0002 security (helpers, guards, RLS) · 0003 workflows (audit, notifications, RPCs) · 0004 storage+realtime · 0005 imports
tests/unit · tests/rls (PGlite) · tests/e2e (Playwright + axe)
```

## Auth flow
Sign in (Supabase Auth, email/password, invite-only) → middleware refreshes the session cookie and keeps signed-out users out of app routes → server layouts call `requirePage(role)` which reads `users.role` and `users.status` **from the database** on every request → redirect to `/mentee`, `/mentor`, `/hod`, `/setup` (onboarding incomplete) or `/suspended`. Every server action and route handler re-checks the caller. Invited users activate via `/auth/confirm?token_hash…&type=invite` → `/accept-invite`.

## Authorization — two layers that must agree
**(a) Postgres.** RLS is on for every table. Helpers (SECURITY DEFINER, fixed `search_path`): `app.user_role()` (named so it doesn't shadow SQL's reserved `current_role`), `app.is_hod()`, `app.is_active_mentor_of(student)`, `app.active_mentor_of(student)`, `app.current_department()`, `app.today()` (IST). Because RLS is row-level only, **guard triggers** protect columns: role/status/department (HOD only, last HOD can't be demoted, can't self-suspend), USN/department locked after onboarding, mentor capacity, verification fields, Pulse "seen" marker, Ask thread fields (students may only resolve/reopen), the 10-minute message edit window and the 5-threads/day limit. Workflows run in transactional definer functions: `assign_students`, `unassign_students`, `verify_semesters`, `return_semester`, `finalize_semester`, `decide_change_request`, `student_update_item`, `import_subjects`, `import_results`, `set_semester_summaries`. Anonymous callers can execute no RPC. `app.is_service()` trusts only the JWT role (never `current_user`, which is the owner inside definer functions).

**(b) Server guards** (`src/server/authz.ts`): `requireUser`, `requireRole`, `assertCanViewStudent`, `assertCanEditMentoring`, `assertCanViewThread`, `isActiveMentorOf`. `tests/unit/server-action-guards.test.ts` fails if any exported server action lacks one, if the service-role client is imported outside `server/admin`, or if a client component imports server-only modules.

Reassignment ends the old row (`ended_at`) and inserts a new one in one transaction; every helper checks `ended_at IS NULL`, so access moves instantly — including open Ask threads and files.

## Authorization matrix

| Resource | Mentee (self) | Mentor (active, own mentee) | Mentor (not assigned / after reassignment) | HOD |
|---|---|---|---|---|
| users, student_profiles | read/update own (identity locked after setup) | read | — | read/update; role & status changes audited |
| mentor_profiles | read own mentor | read/update own (not capacity) | — | all; capacity |
| mentor_assignments | read own | read own rows | read own (ended) rows | via `assign_students` / `unassign_students` only |
| academic_semesters / results / summaries | CRUD while DRAFT; submit/withdraw | read; verify / return via RPC | — | read; verify, finalize; import |
| record_change_requests | create on own VERIFIED/FINALIZED | read; decide via RPC | — | read; decide |
| mentor_recommendations | read SHARED; progress via RPC (can't self-complete goals) | create/update; PRIVATE_MENTOR only the author | — (authored rows stay) | read SHARED only |
| learning_resources + files | own-targeted or "all mentees" of current mentor | own uploads | — | read |
| mentoring_sessions | read | create/update | — | read |
| pulse_checkins | own, current week only | via `mentor_pulse()` (help note only if shared); mark seen | — | **aggregates only** (`hod_pulse_participation`, `hod_mentor_activity`) |
| ask_threads / ask_messages / files | own; resolve/reopen; edit 10 min | read/reply/convert | — (threads move with the student) | **aggregates only** (`hod_ask_summary`, `hod_mentor_activity`) |
| target_plans | own CRUD | read when shared | — | — |
| notifications, content_views, saved_views | own | own | own | own |
| audit_logs | — | — | — | read (insert-only via triggers) |
| settings, schemes, thresholds, structure | read | read | read | write (schemes are versioned) |
| PDF report | — | yes | 403 | yes |
| Exports | — | own mentee list | — | all admin exports (no Pulse/Ask/planner content) |

Storage buckets are private (`avatars`, `resources`, `ask-attachments`) with policies mirroring the table rules; downloads go through `/api/files`, which re-checks the caller and issues a 60-second signed URL. Uploads are size/MIME/extension checked and magic-byte sniffed.

## Engines (pure TypeScript, `src/lib/engine`)
- **Grading:** % only when max exists; weighted total over the components a subject actually has (MSE/SEE/IA, weights renormalised — the brief's formula ignored IA); SEE minimum forces a fail grade; SGPA/CGPA credit-weighted only when every input exists; re-registered subjects count once (latest attempt). Otherwise `{ value: null, reason }`.
- **Insights:** strengths (≥ 2 comparable assessments ≥ threshold), MSE→SEE decline/improvement, SGPA change, needs attention, suggested focus — each with evidence and rule id; missing data → "not enough data", never a negative label.
- **Risk:** declining, missing current-semester results, repeated low marks, failed subject, incomplete profile — each with an explicit reason; thresholds per department.
- **Pulse signal:** 3 consecutive low weeks, or heavy workload + low confidence in the same subject 2 weeks running; always "self-reported"; skipped weeks break streaks and are never a signal.
- **Planner:** required average SGPA with ACHIEVED / COMFORTABLE / ON_TRACK / STRETCH / NOT_REACHABLE; scenario solver keeps the plan consistent with the target; minimum SEE for a target grade including IA and SEE minimum, with step-by-step working.

## Notifications & jobs
Database triggers write in-app notifications for feedback, resources, sessions, verification, corrections, assignments, Ask threads/replies and shared plans; the bell subscribes via Realtime. `/api/cron/daily` (Vercel Cron, once a day at 03:30 UTC ≈ 09:00 IST, `Bearer CRON_SECRET`) sends deduplicated reminders: Ask threads unanswered > 48 h, review dates/overdue items, sessions in the next 24 h, the weekly Pulse prompt and profile nudges on the first day of the Pulse week, and auto-resolves answered threads after 7 days. Email goes through Resend when preferences allow. Because Vercel Hobby runs cron once a day at an imprecise time, Pulse reminders are configured by **day**, not time.

## PDF
`/api/reports/student/[id]` (Node runtime): current mentor or HOD only; audited. Built from VERIFIED/FINALIZED semesters and SHARED items marked `include_in_report`. The component has no inputs for charts, insights, risk, Pulse, planner or Ask. Headings keep with their tables, rows never split, table headers repeat, footer shows page X of Y. Tests extract text and check sections, exclusions and 64-subject pagination.

## Performance
Server-rendered pages; charts are SVG with CSS animation (no chart library on the client); illustrations are inline SVG. Bulk loaders replace per-student queries for rosters and directories. Measured first-load JS ranges from 105 kB (most pages) to ~260 kB (pages that pull the notification sheet, the setup wizard and the assignment board) — see PROGRESS.md.
