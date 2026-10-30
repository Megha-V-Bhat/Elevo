/**
 * Demo data (dev; prod only after explicit approval). Deterministic, so re-running
 * replaces nothing that exists: users are matched by email and skipped if present.
 *   pnpm db:seed && pnpm db:demo
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { cgpa, DEFAULT_SCHEME, gradeSubject, sgpa } from "../src/lib/engine/grading";
import { weekStart } from "../src/lib/engine/pulse";
import { loadEnv } from "./env";
import { seedBase } from "./seed";

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const passwords = { MENTOR: process.env.DEMO_MENTOR_PASSWORD, MENTEE: process.env.DEMO_STUDENT_PASSWORD };
if (!url || !key || !passwords.MENTOR || !passwords.MENTEE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_MENTOR_PASSWORD or DEMO_STUDENT_PASSWORD in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// Deterministic RNG
let seed = 20261027;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const ok = <T>(r: { data: T; error: { message: string } | null }, what: string) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

const CATALOG: Record<number, [string, string, number][]> = {
  1: [["22MAT11", "Calculus & Linear Algebra", 4], ["22PHY12", "Engineering Physics", 4], ["22CIV13", "Elements of Civil Engineering", 3], ["22EME14", "Elements of Mechanical Engg.", 3], ["22PSP15", "Programming in C", 3], ["22ENG16", "Communicative English", 1]],
  2: [["22MAT21", "Advanced Calculus", 4], ["22CHE22", "Engineering Chemistry", 4], ["22ELN23", "Basic Electronics", 3], ["22ELE24", "Basic Electrical Engg.", 3], ["22CAD25", "Computer Aided Drawing", 3], ["22SFH26", "Scientific Foundations of Health", 1]],
  3: [["21MAT31", "Transform Calculus", 3], ["21CS32", "Data Structures", 4], ["21CS33", "Analog & Digital Electronics", 4], ["21CS34", "Computer Organization", 3], ["21CS35", "Object Oriented Programming", 3], ["21CSL36", "Data Structures Lab", 2]],
  4: [["21MAT41", "Discrete Mathematics", 3], ["21CS42", "Design & Analysis of Algorithms", 4], ["21CS43", "Microcontrollers", 4], ["21CS44", "Operating Systems", 3], ["21CS45", "Biology for Engineers", 2], ["21CSL46", "Python Programming Lab", 2]],
  5: [["21CS51", "Automata Theory", 3], ["21CS52", "Computer Networks", 4], ["21CS53", "Database Management Systems", 4], ["21CS54", "Artificial Intelligence", 3], ["21CSL55", "DBMS Lab", 2], ["21RMI56", "Research Methodology", 2]],
  6: [["21CS61", "Software Engineering", 3], ["21CS62", "Full Stack Development", 4], ["21CS63", "Computer Graphics", 4], ["21CS64", "Cloud Computing", 3], ["21CSL66", "Graphics Lab", 2]],
  7: [["21CS71", "Big Data Analytics", 3], ["21CS72", "Machine Learning", 4], ["21CS73", "Cryptography", 3], ["21CS74", "Project Phase I", 2]],
  8: [["21CS81", "Internship", 3], ["21CS82", "Project Phase II", 10]],
};

const FIRST = ["Ananya", "Rohan", "Diya", "Arjun", "Meera", "Kiran", "Ishaan", "Sneha", "Aditya", "Kavya", "Rahul", "Pooja", "Nikhil", "Divya", "Siddharth", "Aishwarya", "Varun", "Neha", "Karthik", "Shreya", "Pranav", "Tanvi", "Manoj", "Riya", "Akash", "Lakshmi", "Harsha", "Bhavana", "Vikram", "Sahana"];
const LAST = ["Rao", "Shetty", "Iyer", "Nair", "Kulkarni", "Hegde", "Reddy", "Bhat", "Menon", "Patil", "Gowda", "Sharma", "Kamath", "Pai", "Joshi"];
const MENTORS: [string, string, string[]][] = [
  ["Dr. Meera Iyer", "Associate Professor", ["Databases", "Data Science"]],
  ["Prof. Arvind Rao", "Assistant Professor", ["Operating Systems", "Placements"]],
  ["Dr. Sunita Kulkarni", "Professor", ["Machine Learning", "Research"]],
  ["Prof. Naveen Shetty", "Assistant Professor", ["Networks", "Cloud"]],
  ["Dr. Farah Khan", "Associate Professor", ["Algorithms", "Competitive coding"]],
  ["Prof. Deepak Menon", "Assistant Professor", ["Web development", "Higher studies"]],
];

async function ensureUser(email: string, role: "MENTEE" | "MENTOR", departmentId: string) {
  const { data: existing } = await db.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) return { id: existing.id as string, created: false };
  const c = await db.auth.admin.createUser({ email, password: passwords[role], email_confirm: true });
  if (c.error || !c.data.user) throw new Error(`create ${email}: ${c.error?.message}`);
  ok(await db.from("users").insert({ id: c.data.user.id, email, role, status: "ACTIVE", department_id: departmentId, onboarding_completed_at: days(-60) }), `user ${email}`);
  return { id: c.data.user.id, created: true };
}

async function main() {
  const { departmentId, hodId } = await seedBase();

  // Subject catalog
  const subjectRows = Object.entries(CATALOG).flatMap(([sem, list]) =>
    list.map(([code, name, credits]) => ({ department_id: departmentId, code, name, credits, semester: Number(sem), has_mse: !code.includes("L") && credits < 10, has_see: true, mse_max: 50, see_max: 100 })),
  );
  ok(await db.from("subjects").upsert(subjectRows, { onConflict: "department_id,code" }), "subjects");
  const { data: subjects } = await db.from("subjects").select("id, code, name, credits, semester, has_mse, has_see, mse_max, see_max").eq("department_id", departmentId);
  const bySem = (n: number) => (subjects ?? []).filter((s) => s.semester === n);

  // Mentors
  const mentorIds: string[] = [];
  const logins: string[] = [];
  for (const [i, [name, designation, expertise]] of MENTORS.entries()) {
    const email = `${name.split(" ").slice(-1)[0].toLowerCase()}.mentor@demo.elevo.app`;
    const u = await ensureUser(email, "MENTOR", departmentId);
    mentorIds.push(u.id);
    logins.push(`| Mentor | ${name} | ${email} |`);
    if (u.created)
      ok(await db.from("mentor_profiles").upsert({ user_id: u.id, full_name: name, designation, expertise, official_email: email, phone: `+91 98450 ${String(10010 + i * 37).slice(-5)}`, faculty_id: `FAC${1040 + i}`, department_id: departmentId, capacity: i === 1 ? 9 : 12 }), "mentor profile");
  }

  // Students
  const kinds = ["improving", "declining", "strong", "steady", "missing", "struggling"] as const;
  const studentIds: { id: string; name: string; kind: (typeof kinds)[number]; sem: number; mentor: string }[] = [];
  for (let i = 0; i < 60; i++) {
    // Second pass over FIRST shifts the surname so all 60 names are distinct.
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7 + Math.floor(i / FIRST.length) * 4) % LAST.length]}`;
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}@demo.elevo.app`;
    const u = await ensureUser(email, "MENTEE", departmentId);
    const sem = 3 + (i % 5);
    const kind = kinds[i % kinds.length];
    const mentor = mentorIds[i % mentorIds.length];
    studentIds.push({ id: u.id, name, kind, sem, mentor });
    if (i < 6) logins.push(`| Student (${kind}) | ${name} | ${email} |`);
    // Resumable: skip students whose records are complete; finish any that a failed run left half-seeded.
    const last = kind === "missing" ? sem - 1 : sem;
    if (!u.created) {
      const { data: done } = await db.from("academic_semesters").select("id, semester_summaries(academic_semester_id)").eq("student_id", u.id).eq("semester_no", last).maybeSingle();
      if (done && (done.semester_summaries as unknown[] | null)?.length) continue;
    }
    const admission = 2026 - Math.ceil(sem / 2);
    ok(
      await db.from("student_profiles").upsert({
        user_id: u.id,
        full_name: name,
        usn: `1EV${String(admission).slice(2)}IS${String(i + 1).padStart(3, "0")}`,
        department_id: departmentId,
        program: "B.E. Information Science & Engineering",
        current_semester: sem,
        section: i % 2 ? "B" : "A",
        admission_year: admission,
        expected_graduation_year: admission + 4,
        phone: `+91 99000 ${String(20000 + i * 13).slice(-5)}`,
        skills: [pick(["Python", "Java", "C++", "JavaScript"]), pick(["SQL", "Git", "Figma", "Linux"])],
        interests: [pick(["AI/ML", "Web development", "Robotics", "Competitive coding", "Design"])],
        career_goals: pick(["Software engineer at a product company", "Higher studies in data science", "Start a small edtech venture", "Research in machine learning"]),
        support_areas: pick(["Time management before exams", "Confidence in maths-heavy subjects", "Choosing electives", ""]),
        profile_completion: kind === "missing" ? 55 : 86 + Math.floor(rnd() * 14),
        created_at: days(-40),
      }),
      "student profile",
    );
    const { data: assigned } = await db.from("mentor_assignments").select("id").eq("student_id", u.id).is("ended_at", null).maybeSingle();
    if (!assigned) ok(await db.rpc("assign_students", { p_student_ids: [u.id], p_mentor_id: mentor, p_reason: "Initial allocation" }), "assignment");

    // Academic history
    const entries: { subject_key: string; semester_no: number; credits: number | null; points: number | null }[] = [];
    for (let s = 1; s <= last; s++) {
      const current = s === sem;
      const trend = kind === "improving" ? (s - 1) * 4 : kind === "declining" ? -(s - 1) * 4 : kind === "strong" ? 14 : kind === "struggling" ? -14 : 0;
      const status = current ? "DRAFT" : s === sem - 1 && i % 3 === 0 ? "SUBMITTED" : s <= 2 ? "FINALIZED" : "VERIFIED";
      const { data: semRow } = await db
        .from("academic_semesters")
        .upsert(
          { student_id: u.id, semester_no: s, academic_year: `${admission + Math.floor((s - 1) / 2)}-${String(admission + Math.floor((s - 1) / 2) + 1).slice(2)}`, status, verified_by: status === "VERIFIED" || status === "FINALIZED" ? mentor : null, verified_at: status === "VERIFIED" || status === "FINALIZED" ? days(-200 + s * 20) : null, submitted_at: status === "SUBMITTED" ? days(-3) : null },
          { onConflict: "student_id,semester_no" }
        )
        .select("id")
        .single();
      const results = bySem(s).map((sub) => {
        const base = clamp(62 + trend + (rnd() - 0.5) * 24, 18, 98);
        const msePct = clamp(base + (rnd() - 0.5) * 12, 10, 100);
        const seePct = current ? null : clamp(base + (rnd() - 0.5) * 16 + (kind === "declining" ? -6 : 0), 12, 100);
        const marks = {
          has_mse: sub.has_mse,
          has_see: sub.has_see,
          mse_marks: sub.has_mse ? Math.round((msePct / 100) * 50) : null,
          mse_max: 50,
          see_marks: seePct == null ? null : Math.round((seePct / 100) * 100),
          see_max: 100,
          ia: [],
        };
        const g = gradeSubject(marks, DEFAULT_SCHEME).value;
        if (!current) entries.push({ subject_key: sub.code, semester_no: s, credits: Number(sub.credits), points: g?.points ?? null });
        return { academic_semester_id: semRow!.id, subject_id: sub.id, mse_marks: marks.mse_marks, mse_max: 50, see_marks: marks.see_marks, see_max: 100, grade: g?.grade ?? null, grade_points: g?.points ?? null, result: g ? (g.passed ? "PASS" : "FAIL") : "PENDING", _credits: Number(sub.credits), _points: g?.points ?? null };
      });
      ok(await db.from("student_subject_results").upsert(results.map((x) => ({ academic_semester_id: x.academic_semester_id, subject_id: x.subject_id, mse_marks: x.mse_marks, mse_max: x.mse_max, see_marks: x.see_marks, see_max: x.see_max, grade: x.grade, grade_points: x.grade_points, result: x.result })), { onConflict: "academic_semester_id,subject_id" }), "results");
      const sg = sgpa(results.map((r) => ({ credits: r._credits, points: r._points })));
      const cg = cgpa(entries);
      ok(
        await db.from("semester_summaries").upsert({
          academic_semester_id: semRow!.id,
          sgpa: sg.value,
          cgpa_snapshot: current ? null : (cg.value?.cgpa ?? null),
          credits_registered: results.reduce((x, r) => x + r._credits, 0),
          credits_earned: results.filter((r) => (r._points ?? 0) > 0).reduce((x, r) => x + r._credits, 0),
          computed: sg.value != null,
          computation_note: sg.reason ? `SGPA not calculated: ${sg.reason}` : null,
        }),
        "summary",
      );
    }
  }

  // Mentoring records, sessions, Pulse, Ask, plans — only for newly created students
  const { data: fresh } = await db.from("mentor_recommendations").select("student_id").limit(1);
  if (!fresh?.length) {
    const recs: Record<string, unknown>[] = [];
    const sess: Record<string, unknown>[] = [];
    const pulse: Record<string, unknown>[] = [];
    const plans: Record<string, unknown>[] = [];
    for (const [i, s] of studentIds.entries()) {
      recs.push(
        { student_id: s.id, mentor_id: s.mentor, kind: "FEEDBACK", category: "ACADEMIC_PROGRESS", title: s.kind === "declining" ? "Let's steady the SEE scores" : "Good consistency this semester", body: s.kind === "declining" ? "Your MSE marks were solid but SEE dropped in two subjects. Let's plan revision earlier this time." : "You're keeping a steady pace. Keep the weekly revision habit going.", status: "PENDING", source: "MANUAL", steps: [], visibility: "SHARED", include_in_report: true, created_at: days(-20) },
        { student_id: s.id, mentor_id: s.mentor, kind: "GOAL", category: "STUDY_HABITS", title: "Weekly problem practice", body: "Two timed problem sets every week until SEE.", target: "60%+ in the weakest subject's SEE", steps: [{ label: "Pick the weakest subject", done: true }, { label: "Solve 2 past papers", done: i % 2 === 0 }, { label: "Review mistakes with mentor", done: false }], status: "IN_PROGRESS", source: "MANUAL", due_date: days(30).slice(0, 10), review_date: days(7).slice(0, 10), visibility: "SHARED", include_in_report: i % 2 === 0, created_at: days(-14) },
        { student_id: s.id, mentor_id: s.mentor, kind: "STRENGTH", category: "PERSONAL_DEVELOPMENT", title: pick(["Clear written answers", "Strong lab work", "Asks good questions", "Reliable team member"]), body: "", status: "PENDING", source: "MANUAL", steps: [], visibility: "SHARED", include_in_report: false, created_at: days(-30) },
        { student_id: s.id, mentor_id: s.mentor, kind: "FEEDBACK", category: "CAREER_GUIDANCE", title: "Private note: discuss internship options", body: "Check interest in summer internships before next session.", status: "PENDING", source: "MANUAL", steps: [], visibility: "PRIVATE_MENTOR", include_in_report: false, created_at: days(-10) },
      );
      if (i % 3 === 0) recs.push({ student_id: s.id, mentor_id: s.mentor, kind: "ACTION_POINT", category: "ACADEMIC_PROGRESS", title: "Submit the pending lab record", body: "", status: "PENDING", steps: [], due_date: days(-2).slice(0, 10), visibility: "SHARED", include_in_report: false, source: "SESSION", created_at: days(-9) });
      sess.push({ mentor_id: s.mentor, student_id: s.id, scheduled_at: days(-9), duration_min: 30, mode: "IN_PERSON", location_or_link: "Staff room, Block B", agenda: "Semester check-in", summary: "Reviewed MSE results and agreed on a revision plan.", action_items: [{ label: "Submit the pending lab record" }], status: "COMPLETED", next_follow_up_date: days(5).slice(0, 10) });
      if (i % 2 === 0) sess.push({ mentor_id: s.mentor, student_id: s.id, scheduled_at: days(1 + (i % 6)), duration_min: 30, mode: i % 4 === 0 ? "ONLINE" : "IN_PERSON", location_or_link: i % 4 === 0 ? "https://meet.google.com/abc-defg-hij" : "Staff room, Block B", agenda: "Pre-SEE plan", action_items: [], status: "SCHEDULED" });
      // Pulse: 8–12 weeks with skips; a few low streaks and heavy+low-confidence cases
      for (let w = 0; w < 12; w++) {
        if (rnd() < 0.18 && w < 9) continue;
        const ws = weekStart(new Date(Date.now() - (11 - w) * 7 * 86_400_000));
        const low = (i % 10 === 1 && w >= 9) || s.kind === "struggling";
        const heavy = i % 10 === 4 && w >= 10;
        const subj = bySem(s.sem).slice(0, 3);
        pulse.push({
          student_id: s.id,
          week_start: ws,
          mood: low ? (w % 2 ? 2 : 1) : clamp(Math.round(3 + (rnd() - 0.4) * 3), 1, 5),
          workload: heavy || (w > 8 && rnd() < 0.3) ? "HEAVY" : rnd() < 0.3 ? "LIGHT" : "OKAY",
          subject_confidence: subj.map((x, k) => ({ subject_id: x.id, subject: x.name, score: heavy && k === 0 ? 2 : clamp(Math.round(2 + rnd() * 3), 1, 5) })),
          help_note: low && w === 11 ? "Feeling behind in two subjects and not sleeping well before tests." : heavy && w === 11 ? "Could use help planning DBMS revision." : null,
          share_note: true,
          seen_by_mentor_at: w < 10 ? days(-(11 - w) * 7 + 2) : null,
        });
      }
      if (i % 5 === 0) plans.push({ student_id: s.id, kind: "CGPA", title: "Reach 8.5 CGPA", inputs: { target: 8.5, remaining_credits: 40 }, result: { required: 9.1, state: "STRETCH" }, shared_with_mentor: i % 10 === 0 });
    }
    for (let k = 0; k < recs.length; k += 200) ok(await db.from("mentor_recommendations").insert(recs.slice(k, k + 200)), "recommendations");
    ok(await db.from("mentoring_sessions").insert(sess), "sessions");
    for (let k = 0; k < pulse.length; k += 300) ok(await db.from("pulse_checkins").upsert(pulse.slice(k, k + 300), { onConflict: "student_id,week_start" }), "pulse");
    ok(await db.from("target_plans").insert(plans), "plans");

    // Resources per mentor
    for (const [m, mentor] of mentorIds.entries()) {
      ok(
        await db.from("learning_resources").insert([
          { mentor_id: mentor, title: "How to revise for SEE in 3 weeks", instructions: "Read sections 1–3 before our next session and mark what feels unclear.", external_url: "https://en.wikipedia.org/wiki/Spaced_repetition" },
          { mentor_id: mentor, title: pick(["Normalisation cheat-sheet", "Process scheduling visual guide", "Big-O quick reference"]), instructions: "Keep this handy while solving past papers.", external_url: "https://en.wikipedia.org/wiki/Database_normalization" },
          { mentor_id: mentor, student_id: studentIds.find((s) => s.mentor === mentor)?.id, title: "Practice set — personalised", instructions: `Prepared for you after our last talk. Attempt 1–5 first. (${m + 1})`, external_url: "https://en.wikipedia.org/wiki/Problem_solving" },
        ]),
        "resources",
      );
    }

    // Ask threads in every status
    for (const [i, s] of studentIds.slice(0, 24).entries()) {
      const status = (["OPEN", "OPEN", "ANSWERED", "RESOLVED"] as const)[i % 4];
      const created = days(-(1 + (i % 6)));
      const { data: t } = await db.from("ask_threads").insert({ student_id: s.id, mentor_id_at_creation: s.mentor, title: pick(["How should I revise normalisation?", "Is it okay to take the ML elective?", "Struggling with recursion problems", "How do I prepare for the internship test?"]), status: "OPEN", created_at: created, last_activity_at: created }).select("id").maybeSingle();
      if (t?.id) {
        ok(await db.from("ask_messages").insert({ thread_id: t.id, author_id: s.id, body: "I've tried the textbook examples but get stuck when the questions combine two ideas. Where should I start?", created_at: created }), "ask message");
        if (status !== "OPEN") {
          ok(await db.from("ask_messages").insert({ thread_id: t.id, author_id: s.mentor, body: "Start from the simplest version and write out each step. Bring two attempts to our next session and we'll go through them.", created_at: days(-(i % 3)) }), "ask reply");
          if (status === "RESOLVED") ok(await db.from("ask_threads").update({ status: "RESOLVED" }).eq("id", t.id), "resolve");
        }
      }
    }

    // A few pending correction requests
    const { data: verified } = await db.from("academic_semesters").select("id, student_id, student_subject_results(id, see_marks)").eq("status", "VERIFIED").limit(3);
    for (const v of verified ?? []) {
      const r = (v.student_subject_results as { id: string; see_marks: number | null }[])[0];
      if (r) ok(await db.from("record_change_requests").insert({ student_id: v.student_id, target_table: "student_subject_results", target_id: r.id, proposed: { see_marks: Math.min(100, Number(r.see_marks ?? 50) + 6) }, reason: "Revaluation result received from the exam cell" }), "change request");
    }
  }

  // One unassigned student for the board demo
  const extra = await ensureUser("new.student@demo.elevo.app", "MENTEE", departmentId);
  if (extra.created) ok(await db.from("student_profiles").upsert({ user_id: extra.id, full_name: "Nisha Kamath", usn: "1EV26IS099", department_id: departmentId, program: "B.E. Information Science & Engineering", current_semester: 1, section: "A", admission_year: 2026, expected_graduation_year: 2030, profile_completion: 60 }), "unassigned student");

  writeFileSync(
    "DEMO.md",
    `# Demo accounts\n\nMentors sign in with \`DEMO_MENTOR_PASSWORD\` and students with \`DEMO_STUDENT_PASSWORD\` from \`.env.local\` (never committed). To change them, edit those values and run \`pnpm db:demo-passwords\`.\n\n| Role | Name | Email |\n|---|---|---|\n| HOD | (you) | value of SEED_HOD_EMAIL |\n${logins.join("\n")}\n| Student (unassigned) | Nisha Kamath | new.student@demo.elevo.app |\n\nThe dataset has 6 mentors, 61 students (one unassigned), 2–7 semesters of results each with improving, declining, strong, steady, missing and struggling patterns, mentoring records, sessions, 8–12 weeks of Pulse check-ins (with skipped weeks and a few self-reported low streaks), Ask threads in every status, saved planner targets and pending correction requests.\n`,
  );
  console.log(`✓ Demo data ready (${studentIds.length} students, ${mentorIds.length} mentors, HOD ${hodId}). See DEMO.md.`);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
