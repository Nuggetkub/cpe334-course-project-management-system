import { expect, test, type Page } from "@playwright/test";
import { E2E_PASSWORD } from "./support";

// Uses "E2E Submission Team" from server/scripts/e2e-prepare.ts: student2@e2e.test is its only
// member, supervisor@e2e.test is assigned, and it has one open and one past-due milestone.

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.getByRole("link", { name: "Milestones", exact: true }).click();
}

const isSubmit = (r: { request(): { method(): string }; url(): string }) =>
  r.request().method() === "POST" && /\/api\/milestones\/\d+\/submissions$/.test(r.url());

test("TEST-05.1e Student submits work and the assigned Supervisor sees the same submission", async ({ page }) => {
  await signIn(page, "student2@e2e.test");
  await page.getByRole("link", { name: "F05 open milestone" }).click();
  await expect(page.getByText("Not submitted yet", { exact: true })).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("F05 browser submission");
  await page.getByLabel("Description (optional)", { exact: true }).fill("Submitted through the real UI");
  await page.getByLabel("Link", { exact: true }).fill("https://example.com/f05-work");
  const saved = page.waitForResponse(isSubmit);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  expect((await saved).status()).toBe(201);
  await expect(page.getByText("Team status: Submitted", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("F05 browser submission", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Submitted by E2E Student 2 on .+ \(ICT\)$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit" })).toHaveCount(0);
  await page.getByRole("button", { name: "Log out" }).click();

  await signIn(page, "supervisor@e2e.test");
  await page.getByLabel("Team", { exact: true }).selectOption({ label: "E2E Submission Team" });
  await page.getByRole("link", { name: "F05 open milestone" }).click();
  await expect(page.getByText("F05 browser submission", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "https://example.com/f05-work" })).toHaveAttribute("href", "https://example.com/f05-work");
  await expect(page.getByText(/^Submitted by E2E Student 2 on /)).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit" })).toHaveCount(0);
});

test("TEST-05.3e the real server rejects a late submission even when the page thinks the window is open", async ({ page }) => {
  // Rewrite only the GET so the page shows the form; the POST goes to the real server unchanged.
  await page.route(/\/api\/milestones\/\d+\/submission$/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (body.milestone) body.milestone = { ...body.milestone, window: "OPEN", teamStatus: "NOT_SUBMITTED" };
    await route.fulfill({ response, json: body });
  });
  await signIn(page, "student2@e2e.test");
  await page.getByRole("link", { name: "F05 past milestone" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Too late");
  await page.getByLabel("Link", { exact: true }).fill("https://example.com/late");
  const rejected = page.waitForResponse(isSubmit);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  const res = await rejected;
  expect(res.status()).toBe(409);
  expect((await res.json()).error.code).toBe("DEADLINE_PASSED");
  await expect(page.getByRole("alert")).toHaveText("The deadline for this milestone has passed.");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Too late");
  await expect(page.getByLabel("Link", { exact: true })).toHaveValue("https://example.com/late");
});
