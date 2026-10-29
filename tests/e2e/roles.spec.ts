import { expect, type Page, test } from "@playwright/test";

/*
 * Signed-in journeys against a seeded Supabase project (pnpm db:seed && pnpm db:demo).
 * Provide credentials via env; the suite is skipped otherwise:
 *   E2E_MENTEE_EMAIL, E2E_MENTOR_EMAIL, E2E_OTHER_MENTOR_EMAIL, E2E_HOD_EMAIL,
 *   E2E_MENTEE_PASSWORD, E2E_MENTOR_PASSWORD (mentors and students have different passwords), E2E_HOD_PASSWORD
 */
const E = process.env;
test.skip(!E.E2E_MENTEE_EMAIL || !E.E2E_MENTEE_PASSWORD || !E.E2E_MENTOR_PASSWORD, "Set E2E_* credentials to run role journeys");
test.describe.configure({ mode: "serial" });

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(mentee|mentor|hod|setup)/);
}

test("mentee lands on their dashboard and can check in", async ({ page }) => {
  await login(page, E.E2E_MENTEE_EMAIL!, E.E2E_MENTEE_PASSWORD!);
  await expect(page).toHaveURL(/\/mentee/);
  await page.goto("/mentee/pulse");
  await page.getByRole("radiogroup", { name: "How did this week feel?" }).getByRole("radio", { name: /Good/ }).click();
  await page.getByLabel("Workload", { exact: true }).getByRole("radio", { name: "Okay" }).click();
  await page.getByRole("button", { name: /check-in/i }).click();
  await expect(page.getByText(/see you next week|Check-in updated/)).toBeVisible();
});

test("mentee cannot open mentor or HOD areas", async ({ page }) => {
  await login(page, E.E2E_MENTEE_EMAIL!, E.E2E_MENTEE_PASSWORD!);
  await page.goto("/hod");
  await expect(page).toHaveURL(/\/mentee/);
  const res = await page.request.get("/api/exports/department-summary");
  expect(res.status()).toBe(403);
});

test("mentee asks a question, mentor sees it in the inbox", async ({ page, browser }) => {
  await login(page, E.E2E_MENTEE_EMAIL!, E.E2E_MENTEE_PASSWORD!);
  await page.goto("/mentee/ask/new");
  const title = `E2E question ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Your question").fill("How should I plan revision?");
  await page.getByRole("button", { name: "Send to my mentor" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 20_000 });
  const ctx = await browser.newContext();
  const mentor = await ctx.newPage();
  await login(mentor, E.E2E_MENTOR_EMAIL!, E.E2E_MENTOR_PASSWORD!);
  await mentor.goto("/mentor/inbox");
  await expect(mentor.getByText(title)).toBeVisible({ timeout: 20_000 });
  await ctx.close();
});

test("a mentor who isn't assigned gets nothing for another mentor's student", async ({ page }) => {
  test.skip(!E.E2E_OTHER_MENTOR_EMAIL || !E.E2E_STUDENT_ID, "needs E2E_OTHER_MENTOR_EMAIL and E2E_STUDENT_ID");
  await login(page, E.E2E_OTHER_MENTOR_EMAIL!, E.E2E_MENTOR_PASSWORD!);
  const pdf = await page.request.get(`/api/reports/student/${E.E2E_STUDENT_ID}`);
  expect(pdf.status()).toBe(403);
  await page.goto(`/mentor/mentees/${E.E2E_STUDENT_ID}`);
  await expect(page.getByText("We couldn't find that page")).toBeVisible();
});

test("HOD sees the assignment board and downloads exports", async ({ page }) => {
  test.skip(!E.E2E_HOD_EMAIL || !E.E2E_HOD_PASSWORD, "needs E2E_HOD_EMAIL and E2E_HOD_PASSWORD");
  await login(page, E.E2E_HOD_EMAIL!, E.E2E_HOD_PASSWORD!);
  await page.goto("/hod/assignments");
  await expect(page.getByRole("region", { name: /Unassigned/ })).toBeVisible();
  const res = await page.request.get("/api/exports/mentor-workload?format=csv");
  expect(res.status()).toBe(200);
  expect(await res.text()).not.toMatch(/help_note|mood|ask_messages/i);
});
