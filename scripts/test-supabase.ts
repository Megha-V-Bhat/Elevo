/**
 * Checks the Supabase connection end to end: the project answers, the anon and
 * service keys work, the schema is there, and a demo mentor can sign in.
 * Prints ✓/✗ per step; never prints keys or passwords.
 *   pnpm db:check
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env";

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
let failed = 0;
const step = (ok: boolean, label: string, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
};

async function main() {
  if (!url || !anon || !service) {
    step(false, "Environment", "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
    return;
  }
  const t = Date.now();
  const health = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anon } }).catch((e: Error) => e);
  step(!(health instanceof Error) && health.ok, "Project reachable", health instanceof Error ? health.message : `HTTP ${health.status} in ${Date.now() - t} ms`);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const counts: string[] = [];
  for (const table of ["users", "student_profiles", "mentor_profiles", "mentor_assignments"]) {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
    if (error) return step(false, "Service key + schema", `${table}: ${error.message}`);
    counts.push(`${table} ${count}`);
  }
  step(true, "Service key + schema", counts.join(", "));

  const { error: rls } = await createClient(url, anon, { auth: { persistSession: false } }).from("users").select("id").limit(1);
  step(!rls, "Anon key accepted", rls ? rls.message : "signed-out reads are filtered by RLS");

  const pw = process.env.DEMO_MENTOR_PASSWORD;
  if (pw) {
    const c = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await c.auth.signInWithPassword({ email: "iyer.mentor@demo.elevo.app", password: pw });
    step(!error && !!data.user, "Demo mentor sign-in", error ? error.message : "iyer.mentor@demo.elevo.app");
  }
}

main()
  .catch((e: Error) => step(false, "Unexpected error", e.message))
  .finally(() => {
    console.log(failed ? `\n${failed} check(s) failed.` : "\nSupabase is working.");
    process.exitCode = failed ? 1 : 0;
  });
