import { expect, test } from "@playwright/test";
import { signIn } from "./support";

// F-12 contract v0.3 TEST-12.1e: real Chromium, API and cpms_e2e database (E2E Overview Alpha and Beta).
test("TEST-12.1e Supervisor filters the overview to Missing, opens the row and comes back with the filter kept", async ({ page }) => {
  await signIn(page, "overview@e2e.test"); // shared helper (D-11)
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(/\/overview$/);

  const table = page.getByRole("table", { name: "Supervisor overview" });
  const rows = table.getByRole("row");
  await expect(rows).toHaveCount(4); // header + 3 milestones: Alpha by due date, then Beta
  await expect(rows.nth(1).getByRole("link", { name: "F12 missing milestone" })).toBeVisible();
  await expect(rows.nth(1).getByText("Missing", { exact: true })).toBeVisible();
  await expect(rows.nth(2).getByRole("link", { name: "F12 not due milestone" })).toBeVisible();
  await expect(rows.nth(2).getByText("Not due", { exact: true })).toBeVisible();
  await expect(rows.nth(3).getByText("E2E Overview Beta", { exact: true })).toBeVisible();
  await expect(rows.nth(3).getByText("Awaiting feedback", { exact: true })).toBeVisible();

  // click, not check(): the router applies the URL change in a transition, so the box is checked a moment later.
  await page.getByRole("checkbox", { name: "Missing", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Missing", exact: true })).toBeChecked();
  await expect(page).toHaveURL(/\/overview\?state=MISSING$/);
  await expect(rows).toHaveCount(2);
  await expect(page.getByText("Page 1 · 1 milestones")).toBeVisible();

  await rows.nth(1).getByRole("link", { name: "F12 missing milestone" }).click();
  await expect(page).toHaveURL(/\/milestones\/\d+$/);
  await expect(page.getByRole("heading", { name: "F12 missing milestone" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/overview\?state=MISSING$/);
  await expect(page.getByRole("checkbox", { name: "Missing", exact: true })).toBeChecked();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1).getByRole("link", { name: "F12 missing milestone" })).toBeVisible();
});
