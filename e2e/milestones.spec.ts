import { expect, test, type Page } from "@playwright/test";
import { E2E_PASSWORD } from "./support";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.getByRole("link", { name: "Milestones", exact: true }).click();
}
function futureBangkokInput() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

test("TEST-04.1e Supervisor creates a persisted milestone and Student reads it after reload", async ({ page }) => {
  await signIn(page, "supervisor@e2e.test");
  await page.getByLabel("Team", { exact: true }).selectOption({ label: "E2E Journey Team" });
  await expect(page.getByText("No milestones yet", { exact: true })).toBeVisible();
  const due = futureBangkokInput();
  await page.getByLabel("Title", { exact: true }).fill("F04 browser prototype");
  await page.getByLabel("Description (optional)", { exact: true }).fill("Real persisted milestone evidence");
  await page.getByLabel("Due date and time (Asia/Bangkok)", { exact: true }).fill(due);
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && /\/milestones$/.test(r.url()));
  await page.getByRole("button", { name: "Create milestone", exact: true }).click();
  const created = await saved;
  expect(created.status()).toBe(201);
  const body = await created.json();
  expect(body.milestone.dueAt).toBe(new Date(`${due}:00+07:00`).toISOString());
  await expect(page.getByRole("link", { name: "F04 browser prototype" })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await signIn(page, "student@e2e.test");
  await expect(page.getByRole("button", { name: "Create milestone" })).toHaveCount(0);
  await page.getByRole("link", { name: "F04 browser prototype" }).click();
  await expect(page).toHaveURL(/\/milestones\/\d+$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "F04 browser prototype" })).toBeVisible();
  await expect(page.getByText("Real persisted milestone evidence")).toBeVisible();
  await expect(page.getByText("Window: Open", { exact: true })).toBeVisible();
  await expect(page.getByText("Team status: Not submitted", { exact: true })).toBeVisible();
  const iso = new Date(`${due}:00+07:00`).toISOString();
  await expect(page.locator(`time[datetime="${iso}"]`)).toContainText("(ICT)");
});

test("TEST-04.2e empty list and field feedback, with a real server rejection of a past deadline", async ({ page }) => {
  await signIn(page, "supervisor@e2e.test");
  await page.getByLabel("Team", { exact: true }).selectOption({ label: "E2E Validation Team" });
  await expect(page.getByText("No milestones yet", { exact: true })).toBeVisible();
  let postCount = 0;
  page.on("request", (r) => { if (r.method() === "POST" && /\/milestones$/.test(r.url())) postCount++; });
  await page.getByRole("button", { name: "Create milestone", exact: true }).click();
  await expect(page.getByText("Enter a title (1–120 characters).", { exact: true })).toBeVisible();
  expect(postCount).toBe(0);
  await page.getByLabel("Title", { exact: true }).fill("Past deadline");
  await page.getByLabel("Due date and time (Asia/Bangkok)", { exact: true }).fill("2020-01-01T12:00");
  const rejected = page.waitForResponse((r) => r.request().method() === "POST" && /\/milestones$/.test(r.url()));
  await page.getByRole("button", { name: "Create milestone", exact: true }).click();
  const res = await rejected;
  expect(res.status()).toBe(400);
  expect((await res.json()).error.fields).toHaveProperty("dueAt");
  await expect(page.getByText("Enter a valid future due date and time.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Past deadline");
  await expect(page.getByText("No milestones yet", { exact: true })).toBeVisible();
});
