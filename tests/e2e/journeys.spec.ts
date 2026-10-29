import { expect, type Browser, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../../scripts/env";

/*
 * Every page, as each role, against the seeded demo project (pnpm db:seed && pnpm db:demo).
 * Reads credentials from .env.local (SEED_HOD_*, DEMO_*_PASSWORD); skipped when they're absent.
 * Run one viewport against a production build:
 *   pnpm build && pnpm start -p 3300
 *   E2E_BASE_URL=http://localhost:3300 pnpm playwright test journeys --project=desktop
 */
loadEnv();
const E = process.env;
const STUDENT = E.E2E_MENTEE_EMAIL ?? "ananya.kulkarni@demo.elevo.app";
const MENTOR = E.E2E_MENTOR_EMAIL ?? "iyer.mentor@demo.elevo.app";
test.skip(!E.DEMO_STUDENT_PASSWORD || !E.DEMO_MENTOR_PASSWORD || !E.SEED_HOD_EMAIL, "needs demo credentials in .env.local");
test.describe.configure({ mode: "serial" });

/** Resets login/ask rate limits and removes the questions earlier runs posted, so the suite can run repeatedly. */
async function clearLoginLimits() {
  if (!E.SUPABASE_SERVICE_ROLE_KEY) return;
  const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL!, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  await admin.from("rate_limits").delete().like("key", "login:%");
  await admin.from("rate_limits").delete().like("key", "ask:%");
  await admin.from("ask_threads").delete().like("title", "E2E question %");
}

async function signIn(browser: Browser, email: string, password: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(mentee|mentor|hod|setup)/, { timeout: 60_000 });
  return page;
}

const TABS = ["overview", "academics", "insights", "mentoring", "resources", "sessions", "journey", "pulse", "ask", "plans", "report"];
const timings: string[] = [];

/** Opens a page and checks it rendered real content: no error boundary, no 404, no console errors. */
async function visit(page: Page, path: string) {
  const errors: string[] = [];
  const onConsole = (m: { type(): string; text(): string }) => {
    if (m.type() === "error" && !/favicon|Failed to load resource.*(403|404)/.test(m.text())) errors.push(m.text());
  };
  const onPageError = (e: Error) => errors.push(e.message);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  const t0 = Date.now();
  const res = await page.goto(path, { waitUntil: "load" });
  const ms = Date.now() - t0;
  timings.push(`${String(ms).padStart(6)} ms  ${path}`);
  expect(res?.status(), `${path} status`).toBeLessThan(400);
  await expect(page.locator("main#main"), `${path} main`).toBeVisible();
  await expect(page.getByText("Something went wrong"), `${path} error boundary`).toHaveCount(0);
  await expect(page.getByText("We couldn't find that page"), `${path} 404`).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow, `${path} horizontal scroll`).toBe(false);
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  expect(errors, `${path} console errors`).toEqual([]);
}

async function firstHref(page: Page, pattern: RegExp) {
  const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  return hrefs.find((h) => pattern.test(h)) ?? null;
}

test.beforeAll(clearLoginLimits);
test.afterAll(async () => {
  console.log("\nPage timings (server render + load):\n" + timings.join("\n"));
  await clearLoginLimits();
});

test("student: every page renders", async ({ browser }) => {
  test.setTimeout(300_000);
  const page = await signIn(browser, STUDENT, E.DEMO_STUDENT_PASSWORD!);
  for (const p of [
    "/mentee",
    "/mentee/academics",
    "/mentee/insights",
    "/mentee/pulse",
    "/mentee/planner",
    "/mentee/ask",
    "/mentee/ask/new",
    "/mentee/journey",
    "/mentee/mentoring",
    "/mentee/sessions",
    "/mentee/resources",
    "/mentee/profile",
    "/notifications",
    "/account",
  ])
    await visit(page, p);
  await visit(page, "/mentee/academics");
  const sem = await firstHref(page, /^\/mentee\/academics\/\d+$/);
  expect(sem, "a semester link").not.toBeNull();
  await visit(page, sem!);
  await visit(page, "/mentee/ask");
  const thread = await firstHref(page, /^\/mentee\/ask\/[0-9a-f-]{36}$/);
  if (thread) await visit(page, thread);
  await page.context().close();
});

test("student: role boundaries hold", async ({ browser }) => {
  const page = await signIn(browser, STUDENT, E.DEMO_STUDENT_PASSWORD!);
  for (const p of ["/hod", "/mentor", "/hod/users"]) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/(mentee|403)/);
  }
  expect((await page.request.get("/api/exports/department-summary?format=csv")).status()).toBe(403);
  await page.context().close();
});

test("student: Pulse check-in, planner save and a question to the mentor", async ({ browser }) => {
  const page = await signIn(browser, STUDENT, E.DEMO_STUDENT_PASSWORD!);
  await page.goto("/mentee/pulse");
  await page.getByRole("radiogroup", { name: "How did this week feel?" }).getByRole("radio", { name: /Good/ }).click();
  await page.getByLabel("Workload", { exact: true }).getByRole("radio", { name: "Okay" }).click();
  await page.getByRole("button", { name: /check-in/i }).click();
  await expect(page.getByText(/see you next week|Check-in updated/)).toBeVisible({ timeout: 30_000 });

  await page.goto("/mentee/planner");
  const save = page.getByRole("button", { name: "Save plan" }).first();
  if (await save.isEnabled()) {
    await save.click();
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 30_000 });
  }

  await page.goto("/mentee/ask/new");
  const title = `E2E question ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Your question").fill("How should I split revision time between maths and DBMS this month?");
  await page.getByRole("button", { name: "Send to my mentor" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
  await page.context().close();

  const mentor = await signIn(browser, MENTOR, E.DEMO_MENTOR_PASSWORD!);
  await mentor.goto("/mentor/inbox");
  await expect(mentor.getByText(title)).toBeVisible({ timeout: 30_000 });
  await mentor.context().close();
});

test("student: PDF report of own record downloads", async ({ browser }) => {
  const page = await signIn(browser, STUDENT, E.DEMO_STUDENT_PASSWORD!);
  await page.goto("/mentee/profile");
  const href = await firstHref(page, /^\/api\/reports\/student\//);
  if (href) {
    const res = await page.request.get(href);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
  }
  await page.context().close();
});

test("mentor: every page renders", async ({ browser }) => {
  test.setTimeout(300_000);
  const page = await signIn(browser, MENTOR, E.DEMO_MENTOR_PASSWORD!);
  for (const p of [
    "/mentor",
    "/mentor/mentees",
    "/mentor/inbox",
    "/mentor/verifications",
    "/mentor/sessions",
    "/mentor/recommendations",
    "/mentor/resources",
    "/mentor/reports",
    "/mentor/analytics",
    "/notifications",
    "/account",
  ])
    await visit(page, p);
  await visit(page, "/mentor/mentees");
  const mentee = await firstHref(page, /^\/mentor\/mentees\/[0-9a-f-]{36}/);
  expect(mentee, "a mentee link").not.toBeNull();
  const base = mentee!.split("?")[0];
  for (const tab of ["", ...TABS.map((t) => `?tab=${t}`)]) await visit(page, base + tab);
  const pdf = await page.request.get(`/api/reports/student/${base.split("/").pop()}`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  await visit(page, "/mentor/inbox");
  const thread = await firstHref(page, /^\/mentor\/inbox\/[0-9a-f-]{36}$/);
  if (thread) await visit(page, thread);
  expect((await page.request.get("/api/exports/mentees?format=xlsx")).status()).toBe(200);
  for (const p of ["/hod", "/mentee"]) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/(mentor|403)/);
  }
  await page.context().close();
});

test("HOD: every page renders, exports and templates download", async ({ browser }) => {
  test.setTimeout(300_000);
  const page = await signIn(browser, E.SEED_HOD_EMAIL!, E.SEED_HOD_PASSWORD!);
  for (const p of [
    "/hod",
    "/hod/students",
    "/hod/mentors",
    "/hod/assignments",
    "/hod/interventions",
    "/hod/analytics",
    "/hod/imports",
    "/hod/exports",
    "/hod/users",
    "/hod/settings",
    "/hod/audit",
    "/notifications",
    "/account",
  ])
    await visit(page, p);
  await visit(page, "/hod/students");
  const student = await firstHref(page, /^\/hod\/students\/[0-9a-f-]{36}/);
  expect(student, "a student link").not.toBeNull();
  await visit(page, student!);
  await visit(page, "/hod/mentors");
  const mentor = await firstHref(page, /^\/hod\/mentors\/[0-9a-f-]{36}/);
  expect(mentor, "a mentor link").not.toBeNull();
  await visit(page, mentor!);

  for (const k of ["department-summary", "academic-summary", "mentor-workload", "assignments", "interventions"])
    for (const f of ["csv", "xlsx", "pdf"]) {
      const res = await page.request.get(`/api/exports/${k}?format=${f}`);
      expect(res.status(), `${k}.${f}`).toBe(200);
    }
  await visit(page, "/hod/imports");
  const tpl = await firstHref(page, /^\/api\/imports\/template\?/);
  if (tpl) expect((await page.request.get(tpl)).status()).toBe(200);
  await page.context().close();
});

test("anonymous visitors are sent to sign in", async ({ page }) => {
  for (const p of ["/mentee", "/mentor", "/hod", "/account"]) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/login/);
  }
  expect((await page.request.get("/api/exports/department-summary?format=csv", { maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(300);
});
