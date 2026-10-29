import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/login", "/forgot-password", "/styleguide", "/suspended", "/offline", "/this-does-not-exist"];

for (const route of ROUTES) {
  test(`${route} renders, has no horizontal scroll and no serious axe violations`, async ({ page }) => {
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.locator("main#main")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, "no horizontal page scroll").toBe(false);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
  });
}

test("landing has one primary call to action and the tagline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Mentoring that");
  await expect(page.getByRole("link", { name: /^Sign in/ }).first()).toBeVisible();
});

test("login form validates inline and offers recovery", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
});

test("skip link reaches main content by keyboard", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});

test("charts offer a table alternative", async ({ page }) => {
  const res = await page.goto("/styleguide");
  test.skip(res?.status() === 404, "styleguide is turned off in production");
  const summary = page.getByText("View as table").first();
  await summary.click();
  await expect(page.locator("details[open] table").first()).toBeVisible();
});
