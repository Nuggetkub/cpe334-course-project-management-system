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
