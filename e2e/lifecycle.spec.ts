import { expect, test } from "@playwright/test";
import { signIn } from "./support";

// F-08 contract TEST-08.1e: real Chromium, API and cpms_e2e database.
// datetime-local value in Asia/Bangkok, `days` from now.
const bangkok = (days: number) => new Date(Date.now() + days * 24 * 3600 * 1000 + 7 * 3600 * 1000).toISOString().slice(0, 16);

test("TEST-08.1e Supervisor edits, extends, sets a late window and closes; the Student sees it closed", async ({ page }) => {
  await signIn(page, "supervisor@e2e.test");
  await page.getByLabel("Team", { exact: true }).selectOption({ label: "E2E Lifecycle Team" });
  await page.getByLabel("Title", { exact: true }).fill("F08 lifecycle");
  await page.getByLabel("Due date and time (Asia/Bangkok)", { exact: true }).fill(bangkok(3));
  await page.getByRole("button", { name: "Create milestone", exact: true }).click();
  await page.getByRole("link", { name: "F08 lifecycle" }).click();

  await page.getByLabel("Milestone title", { exact: true }).fill("F08 lifecycle edited");
  const extended = bangkok(5);
  await page.getByLabel("Due date and time (Asia/Bangkok)", { exact: true }).fill(extended);
  await page.getByLabel("Late window end (Asia/Bangkok)", { exact: true }).fill(bangkok(6));
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Milestone updated.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "F08 lifecycle edited" })).toBeVisible();
  await expect(page.locator(`time[datetime="${new Date(`${extended}:00+07:00`).toISOString()}"]`).first()).toBeVisible();
  await expect(page.getByText(/^Late until /)).toBeVisible();
  await expect(page.getByText("Window: Open", { exact: true })).toBeVisible(); // deadline still ahead

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Close milestone", exact: true }).click();
  await expect(page.getByText("Milestone closed.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Window: Closed", { exact: true })).toBeVisible();
  const url = page.url();
  await page.getByRole("button", { name: "Log out" }).click();

  await signIn(page, "student3@e2e.test");
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "F08 lifecycle edited" })).toBeVisible();
  await expect(page.getByText("Window: Closed", { exact: true })).toBeVisible();
  await expect(page.getByText("This milestone is closed.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Manage milestone" })).toHaveCount(0);

  // A milestone seeded between its due date and its late-window end shows the Late window badge.
  await page.getByRole("link", { name: "Milestones", exact: true }).click();
  await page.getByRole("link", { name: "F08 late milestone" }).click();
  await expect(page.getByText("Window: Late window", { exact: true })).toBeVisible();
});
