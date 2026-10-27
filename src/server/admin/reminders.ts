import "server-only";
import { currentWeekStart, todayLocal } from "@/lib/dates";
import { adminDb } from "./client";
import { sendEmail } from "./email";

type Notice = { user_id: string; type: string; title: string; body: string; link: string; entity_type?: string; entity_id?: string };

/**
 * Daily job (Vercel Cron, once a day ≈ 09:00 IST). System-level: runs with the
 * service role after the CRON_SECRET check in the route. Each reminder is deduplicated
 * against notifications already sent.
 */
export async function runDailyReminders(now = new Date()) {
  const db = adminDb();
  const today = todayLocal(now).toISOString().slice(0, 10);
  const notices: Notice[] = [];
  const recent = async (type: string, days: number) => {
    const { data } = await db.from("notifications").select("user_id, entity_id").eq("type", type).gte("created_at", new Date(now.getTime() - days * 86_400_000).toISOString());
    return new Set((data ?? []).map((r) => `${r.user_id}|${r.entity_id ?? ""}`));
  };

  // 1) Ask threads unanswered for more than 48 hours → remind the CURRENT mentor (once per 2 days)
  const sentAsk = await recent("ask-reminder", 2);
  const { data: waiting } = await db.from("ask_threads").select("id, student_id, title").eq("status", "OPEN").is("first_response_at", null).lt("created_at", new Date(now.getTime() - 48 * 3600_000).toISOString());
  if (waiting?.length) {
    const { data: asg } = await db.from("mentor_assignments").select("student_id, mentor_id").in("student_id", waiting.map((w) => w.student_id)).is("ended_at", null);
    const mOf = new Map((asg ?? []).map((a) => [a.student_id, a.mentor_id]));
    for (const w of waiting) {
      const m = mOf.get(w.student_id);
      if (m && !sentAsk.has(`${m}|${w.id}`)) notices.push({ user_id: m, type: "ask-reminder", title: "A question has waited over 48 hours", body: w.title, link: `/mentor/inbox/${w.id}`, entity_type: "ask_threads", entity_id: w.id });
    }
  }

  // 2) Mentor follow-ups: review dates today, overdue goals/action points (once per day)
  const sentFollow = await recent("follow-up", 1);
  const { data: due } = await db.from("mentor_recommendations").select("id, mentor_id, student_id, title, review_date, due_date").neq("status", "COMPLETED").or(`review_date.eq.${today},due_date.lt.${today}`).limit(1000);
  for (const r of due ?? []) {
    if (!sentFollow.has(`${r.mentor_id}|${r.id}`))
      notices.push({ user_id: r.mentor_id, type: "follow-up", title: r.due_date && r.due_date < today ? "Overdue: follow up with your mentee" : "Review due today", body: r.title, link: `/mentor/mentees/${r.student_id}?tab=mentoring`, entity_type: "mentor_recommendations", entity_id: r.id });
  }

  // 3) Sessions in the next 24 hours → student and mentor (once)
  const sentSess = await recent("session-soon", 2);
  const { data: soon } = await db.from("mentoring_sessions").select("id, student_id, mentor_id, scheduled_at").eq("status", "SCHEDULED").gte("scheduled_at", now.toISOString()).lte("scheduled_at", new Date(now.getTime() + 24 * 3600_000).toISOString());
  for (const s of soon ?? []) {
    const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(s.scheduled_at));
    for (const [u, link] of [
      [s.student_id, "/mentee/sessions"],
      [s.mentor_id, "/mentor/sessions"],
    ] as const)
      if (!sentSess.has(`${u}|${s.id}`)) notices.push({ user_id: u, type: "session-soon", title: "Mentoring session tomorrow", body: when, link, entity_type: "mentoring_sessions", entity_id: s.id });
  }

  // 4) Weekly: Pulse prompt and incomplete-profile nudges on the first day of the Pulse week
  const { data: settings } = await db.from("app_settings").select("key, value").in("key", ["pulse_week_start", "pulse_reminder_enabled"]);
  const cfg = Object.fromEntries((settings ?? []).map((r) => [r.key, r.value]));
  const startDay = Number(cfg.pulse_week_start ?? 1);
  const week = currentWeekStart(startDay);
  if (week === today) {
    const { data: mentees } = await db.from("users").select("id").eq("role", "MENTEE").eq("status", "ACTIVE");
    const ids = (mentees ?? []).map((m) => m.id);
    if (cfg.pulse_reminder_enabled !== false && ids.length) {
      const { data: done } = await db.from("pulse_checkins").select("student_id").eq("week_start", week);
      const doneSet = new Set((done ?? []).map((d) => d.student_id));
      for (const id of ids) if (!doneSet.has(id)) notices.push({ user_id: id, type: "pulse", title: "Your weekly check-in", body: "Three quick questions — about 30 seconds.", link: "/mentee/pulse" });
    }
    const { data: incomplete } = await db.from("student_profiles").select("user_id, profile_completion").lt("profile_completion", 80);
    for (const p of incomplete ?? []) notices.push({ user_id: p.user_id, type: "profile", title: "Finish your profile", body: `It's ${p.profile_completion}% complete — it helps your mentor support you.`, link: "/mentee/profile" });
  }

  // 5) Auto-resolve answered threads after 7 days
  const { data: resolved } = await db.rpc("auto_resolve_threads");

  // Write in-app notifications, then email where preferences allow
  for (let i = 0; i < notices.length; i += 500) {
    const { error } = await db.from("notifications").insert(notices.slice(i, i + 500));
    if (error) console.error("[elevo] reminder insert failed", error.message);
  }
  let emailed = 0;
  const emailTypes: Record<string, string> = { "ask-reminder": "email_ask", "session-soon": "email_sessions", pulse: "email_pulse", "follow-up": "email_followups" };
  const targets = [...new Set(notices.filter((n) => emailTypes[n.type]).map((n) => n.user_id))];
  if (targets.length && process.env.RESEND_API_KEY) {
    const { data: users } = await db.from("users").select("id, email, notification_prefs").in("id", targets.slice(0, 500));
    for (const u of users ?? []) {
      const prefs = (u.notification_prefs ?? {}) as Record<string, boolean>;
      for (const n of notices.filter((x) => x.user_id === u.id && emailTypes[x.type])) {
        if (prefs[emailTypes[n.type]] === false || (n.type === "pulse" && prefs.pulse_reminder === false)) continue;
        if (await sendEmail(u.email, n.title, { title: n.title, body: n.body, cta: "Open Elevo", href: n.link })) emailed++;
      }
    }
  }
  return { notifications: notices.length, emailed, autoResolved: resolved ?? 0 };
}
