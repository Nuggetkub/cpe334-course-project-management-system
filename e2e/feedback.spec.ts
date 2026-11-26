import { expect, test } from "@playwright/test";
import { signIn } from "./support";

// Uses "F06 submitted milestone" from server/scripts/e2e-prepare.ts: Student 2 has already
// submitted it, and supervisor@e2e.test is assigned to its team.

test("TEST-06.1e Supervisor records feedback and the team's Student reads it with its version", async ({ page }) => {
  await signIn(page, "supervisor@e2e.test");
  await page.getByLabel("Team", { exact: true }).selectOption({ label: "E2E Submission Team" });
  await page.getByRole("link", { name: "F06 submitted milestone" }).click();
  await expect(page.getByText("No feedback yet", { exact: true })).toBeVisible();
  await page.getByLabel("Feedback", { exact: true }).fill("Clear structure. Add tests for the login page.");
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && /\/api\/submissions\/\d+\/feedback$/.test(r.url()));
  await page.getByRole("button", { name: "Add feedback", exact: true }).click();
  expect((await saved).status()).toBe(201);
  await expect(page.getByText("Feedback added.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();

  await signIn(page, "student2@e2e.test");
  await page.getByRole("link", { name: "F06 submitted milestone" }).click();
  await page.reload();
  await expect(page.getByText("Clear structure. Add tests for the login page.", { exact: true })).toBeVisible();
  await expect(page.getByText(/^E2E Supervisor on .+ \(ICT\) · version 1$/)).toBeVisible();
  await expect(page.getByLabel("Feedback", { exact: true })).toHaveCount(0);
});
