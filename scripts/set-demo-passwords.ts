/**
 * Applies DEMO_MENTOR_PASSWORD / DEMO_STUDENT_PASSWORD to the existing demo accounts
 * (@demo.elevo.app only; the HOD and real users are never touched). Role comes from
 * public.users, not from the email. Passwords are never printed.
 *   pnpm db:demo-passwords
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env";

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const passwords: Record<string, string | undefined> = { MENTOR: process.env.DEMO_MENTOR_PASSWORD, MENTEE: process.env.DEMO_STUDENT_PASSWORD };
if (!url || !key || !passwords.MENTOR || !passwords.MENTEE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_MENTOR_PASSWORD or DEMO_STUDENT_PASSWORD in .env.local");
  process.exit(1);
}
if (passwords.MENTOR === passwords.MENTEE) {
  console.error("DEMO_MENTOR_PASSWORD and DEMO_STUDENT_PASSWORD must be different");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await db.from("users").select("id, email, role").like("email", "%@demo.elevo.app").in("role", ["MENTOR", "MENTEE"]);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = { MENTOR: 0, MENTEE: 0 };
  for (const u of data ?? []) {
    const r = await db.auth.admin.updateUserById(u.id, { password: passwords[u.role]! });
    if (r.error) throw new Error(`${u.email}: ${r.error.message}`);
    counts[u.role]++;
  }
  console.log(`Updated ${counts.MENTOR} mentors and ${counts.MENTEE} students.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
