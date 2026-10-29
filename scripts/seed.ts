/**
 * Base seed (idempotent): department, sections, academic year, default grading scheme,
 * risk thresholds, app settings and the first HOD from SEED_HOD_EMAIL / SEED_HOD_PASSWORD.
 *   pnpm db:seed
 */
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_SCHEME } from "../src/lib/engine/grading";
import { DEFAULT_INSIGHT_THRESHOLDS } from "../src/lib/engine/insights";
import { DEFAULT_RISK_THRESHOLDS } from "../src/lib/engine/risk";
import { loadEnv } from "./env";

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hodEmail = process.env.SEED_HOD_EMAIL?.toLowerCase();
const hodPassword = process.env.SEED_HOD_PASSWORD;
if (!url || !key || !hodEmail || !hodPassword) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_HOD_EMAIL or SEED_HOD_PASSWORD in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const ok = <T>(r: { data: T; error: { message: string } | null }, what: string) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

export async function seedBase() {
  const dept = ok(await db.from("departments").upsert({ code: "ISE", name: "Information Science & Engineering", institution: "NMAM Institute of Technology, Nitte" }, { onConflict: "code" }).select("id").single(), "department")!;
  ok(await db.from("sections").upsert(["A", "B"].map((name) => ({ department_id: dept.id, name })), { onConflict: "department_id,name" }), "sections");
  ok(await db.from("academic_years").upsert({ label: "2026-27", starts_on: "2026-08-01", ends_on: "2027-07-31", is_current: true }, { onConflict: "label" }), "academic year");

  const { data: scheme } = await db.from("grading_schemes").select("id").eq("department_id", dept.id).limit(1).maybeSingle();
  if (!scheme)
    ok(
      await db.from("grading_schemes").insert({
        department_id: dept.id,
        name: "10-point credit-weighted",
        version: 1,
        active: true,
        bands: DEFAULT_SCHEME.bands,
        pass_pct: DEFAULT_SCHEME.pass_pct,
        mse_weight: DEFAULT_SCHEME.mse_weight,
        see_weight: DEFAULT_SCHEME.see_weight,
        ia_weight: DEFAULT_SCHEME.ia_weight,
        see_min_pct: DEFAULT_SCHEME.see_min_pct,
        max_points: DEFAULT_SCHEME.max_points,
      }),
      "grading scheme",
    );

  const thresholds = { ...DEFAULT_INSIGHT_THRESHOLDS, ...DEFAULT_RISK_THRESHOLDS };
  ok(await db.from("risk_thresholds").upsert(Object.entries(thresholds).map(([rule_key, v]) => ({ department_id: dept.id, rule_key, value: { v } }))), "thresholds");

  const settings: Record<string, unknown> = {
    program_total_credits: 160,
    pulse_week_start: 1,
    pulse_reminder_enabled: true,
    optional_profile_fields: { dob: false, gender: false, address: false },
    institution: "NMAM Institute of Technology, Nitte",
  };
  for (const [k, value] of Object.entries(settings)) {
    const { data } = await db.from("app_settings").select("key").eq("key", k).maybeSingle();
    if (!data) ok(await db.from("app_settings").insert({ key: k, value }), `setting ${k}`);
  }

  // First HOD
  const { data: existing } = await db.from("users").select("id").eq("email", hodEmail!).maybeSingle();
  let hodId = existing?.id as string | undefined;
  if (!hodId) {
    const created = await db.auth.admin.createUser({ email: hodEmail!, password: hodPassword!, email_confirm: true });
    if (created.error && !/already/i.test(created.error.message)) throw new Error(`HOD auth user: ${created.error.message}`);
    hodId = created.data.user?.id;
    if (!hodId) {
      const list = await db.auth.admin.listUsers({ perPage: 1000 });
      hodId = list.data.users.find((u) => u.email?.toLowerCase() === hodEmail)?.id;
    }
    ok(await db.from("users").upsert({ id: hodId, email: hodEmail, role: "HOD", status: "ACTIVE", department_id: dept.id }), "HOD user");
    ok(await db.from("mentor_profiles").upsert({ user_id: hodId, full_name: "", department_id: dept.id }), "HOD profile");
  }
  console.log(`✓ Base seed done. Department ${dept.id}. HOD ${hodEmail} (sign in and finish the setup wizard).`);
  return { departmentId: dept.id as string, hodId: hodId! };
}

if (process.argv[1]?.includes("seed.ts")) {
  seedBase().catch((e) => {
    console.error("✗", e.message);
    process.exit(1);
  });
}
