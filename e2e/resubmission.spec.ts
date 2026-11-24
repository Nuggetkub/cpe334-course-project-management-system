import { expect, test, type Page } from "@playwright/test";
import { E2E_PASSWORD } from "./support";

// F-09 contract TEST-09.1e: real Chromium, API and cpms_e2e database.
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.getByRole("link", { name: "Milestones", exact: true }).click();
}

test("TEST-09.1e Student submits version 2; both roles see the versions after reload", async ({ page }) => {
  await signIn(page, "student3@e2e.test");
  await page.getByRole("link", { name: "F09 resubmission milestone" }).click();
  await expect(page.getByRole("heading", { name: "Submit a new version" })).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("F09 second version");
  await page.getByLabel("Link", { exact: true }).fill("https://example.com/f09-v2");
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && /\/submissions$/.test(r.url()));
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  const res = await saved;
  expect(res.status()).toBe(201);
  expect((await res.json()).submission).toMatchObject({ version: 2, late: false });
  await page.reload();
  await expect(page.getByText("Version 2", { exact: true })).toBeVisible();
  await expect(page.getByText("F09 second version", { exact: true })).toBeVisible();
  const earlier = page.getByRole("region", { name: "Earlier versions" });
  await expect(earlier.getByText("Version 1", { exact: true })).toBeVisible();
  await expect(earlier.getByText("F09 first version", { exact: true })).toBeVisible();
  const url = page.url();
  await page.getByRole("button", { name: "Log out" }).click();

  await signIn(page, "supervisor@e2e.test");
  await page.goto(url);
  await expect(page.getByText("F09 second version", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Earlier versions" }).getByText("F09 first version", { exact: true })).toBeVisible();
});
