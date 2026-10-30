# DEPLOY.md — production checklist

These steps need your accounts and secrets, so they're manual. Never paste secrets into chat or commit them.

## 1. Supabase production project (`elevo-prod`)
1. supabase.com → New project → name `elevo-prod`, region Mumbai (ap-south-1), generate and save the DB password.
2. **Authentication → Sign In / Providers:** Email on; **"Allow new users to sign up" off**; "Confirm email" on.
3. **Authentication → Emails → SMTP:** Custom SMTP → host `smtp.resend.com`, port `465`, user `resend`, password = Resend API key, sender = your verified domain address (Resend only delivers to your own address until a domain is verified).
4. **Authentication → Emails → Templates:** paste `supabase/templates/invite.html` (Invite user), `recovery.html` (Reset password) and `magic_link.html` (Magic link). Subjects are in `supabase/templates/SUBJECTS.md`.
5. Apply the schema from your machine, with prod values in a temporary `.env.production.local` (delete it afterwards):
   ```bash
   pnpm supabase link --project-ref <prod ref>
   pnpm db:push
   pnpm db:seed          # department, scheme, thresholds, first HOD
   # pnpm db:demo        # only if you want demo data in prod
   ```
6. **Database → Publications:** confirm `supabase_realtime` includes `notifications` (migration 0004 adds it when the publication exists).
7. **Advisors:** Database → Advisors → Security and Performance should show no errors.

## 2. Vercel
Current production: https://elevo-woad.vercel.app (team "Megha", project `elevo`). `vercel.json` pins functions to `syd1` (same region as the current Sydney Supabase project; change it to `bom1` if you move the database to Mumbai) and turns on Fluid compute.

1. vercel.com → Add New → Project → import `elevo` → framework Next.js. Importing needs a GitHub login connection in Vercel → Account Settings → Authentication. Without one, deploy from your machine: `npx vercel login`, `npx vercel link --project elevo`, `npx vercel deploy --prod`. A `.vercelignore` keeps `.env*`, `report/` and logs out of the upload.
2. Environment variables (Production): `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` (new random value). Do **not** add `SUPABASE_DB_URL`, `SUPABASE_ACCESS_TOKEN` or the seed/demo passwords.
3. Deploy. Copy the URL, then in Supabase → Authentication → URL Configuration set Site URL and Redirect URLs (`https://<app>/**`) to it. Update `NEXT_PUBLIC_SITE_URL` and redeploy if it changed.
4. **Settings → Cron Jobs:** `/api/cron/daily` should be listed (03:30 UTC ≈ 09:00 IST). Click Run once and confirm a 200 in Logs.

## 3. Smoke test (10 minutes)
1. Sign in as the HOD on phone and laptop; finish setup.
2. Invite a mentor and a student (emails you own); accept both invites; finish both wizards.
3. Assign the student to the mentor. As the student: Pulse check-in, ask a question, save and share a planner target. As the mentor: see all three and reply.
4. Reassign the student to another mentor. The first mentor must no longer open the student, their Pulse or their question (404/403).
5. As the new mentor, download the PDF: no charts, insights, Pulse, planner or questions.
6. Run the signed-in journeys against the deployment (they read demo credentials from `.env.local`, clean up their own questions and reset login/ask rate limits):
   `E2E_BASE_URL=https://<app> pnpm playwright test journeys --project=desktop`
7. To profile, set `PERF_LOG=1` in Vercel, redeploy, and read the `[perf]` lines with `npx vercel logs <deployment> --since 10m`. Remove it afterwards.

## 4. Keep it healthy
- Free Supabase projects pause after inactivity; restore from the dashboard or upgrade for real use.
- Real student data: enable backups (Pro) or run a weekly `pnpm supabase db dump`.
- Leaked key: Supabase → API Keys → roll, update Vercel env, redeploy.
