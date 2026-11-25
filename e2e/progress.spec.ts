import { expect, test } from "@playwright/test";
import { E2E_PASSWORD } from "./support";

// F-11 contract v0.3 TEST-11.1e: real Chromium, API and cpms_e2e database (E2E Progress Team).
test("TEST-11.1e Student reads the progress board and follows a row to the milestone page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("student4@e2e.test");
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Progress", exact: true }).click();

  const table = page.getByRole("table", { name: "Progress for E2E Progress Team" });
  await expect(table).toBeVisible();
  const rows = table.getByRole("row");
  await expect(rows).toHaveCount(3); // header + 2 milestones, in due order
  const submitted = rows.nth(1);
  await expect(submitted.getByRole("link", { name: "F11 submitted milestone" })).toBeVisible();
  await expect(submitted.getByText("Version 1", { exact: true })).toBeVisible();
  await expect(submitted.getByText("Feedback received", { exact: true })).toBeVisible();
  const open = rows.nth(2);
  await expect(open.getByRole("link", { name: "F11 open milestone" })).toBeVisible();
  await expect(open.getByText("Not submitted", { exact: true }).first()).toBeVisible();
  // Phase 1: no Grade column and no grade text.
  await expect(table.getByRole("columnheader", { name: "Grade" })).toHaveCount(0);
  await expect(page.getByText("Not released")).toHaveCount(0);

  await submitted.getByRole("link", { name: "F11 submitted milestone" }).click();
  await expect(page).toHaveURL(/\/milestones\/\d+$/);
  await expect(page.getByRole("heading", { name: "F11 submitted milestone" })).toBeVisible();
  await expect(page.getByText("F11 work", { exact: true })).toBeVisible();
});

// F-11 contract v0.4 TEST-11.6e: no viewport scrolls sideways, even for a 120-character unbroken title.
// 390 px uses the stacked rows; 768 px is just above the 640 px breakpoint, where the table layout returns.
for (const viewport of [390, 768]) test(`TEST-11.6e the board stays within a ${viewport} px viewport`, async ({ page }) => {
  await page.setViewportSize({ width: viewport, height: 844 });
  const title = "A".repeat(120); // the longest valid milestone title, with no break opportunity
  await page.route("**/api/teams/*/progress*", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.rows[0].title = title;
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("student4@e2e.test");
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport);
  const link = await page.getByRole("link", { name: title }).boundingBox();
  expect(link!.x + link!.width).toBeLessThanOrEqual(viewport);
});
