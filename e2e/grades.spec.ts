import { expect, test, type Browser, type Page } from "@playwright/test";
import { E2E_PASSWORD } from "./support";

// F-10 contract v0.2 TEST-10.1e: real Chromium, API and cpms_e2e database ("E2E Team Grades").
// The Supervisor and the Student use separate browser contexts (separate sessions).
async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.getByRole("link", { name: "Milestones", exact: true }).click();
  return page;
}

test("TEST-10.1e a saved draft stays hidden from the Student until the Supervisor releases it", async ({ browser }) => {
  const supervisor = await signIn(browser, "supervisor@e2e.test");
  await supervisor.getByLabel("Team", { exact: true }).selectOption({ label: "E2E Team Grades" });
  await supervisor.getByRole("link", { name: "F10 graded milestone" }).click();
  const url = supervisor.url();
  const supGrade = supervisor.getByRole("region", { name: "Grade" });
  await expect(supGrade.getByText("Not released yet", { exact: true })).toBeVisible();

  // Save a draft of 85 through the real API.
  await supGrade.getByLabel("Score (0–100)").fill("85");
  const saved = supervisor.waitForResponse((r) => r.request().method() === "PUT" && /\/grade$/.test(r.url()));
  await supGrade.getByRole("button", { name: "Save draft" }).click();
  expect((await saved).status()).toBe(200);
  await expect(supGrade.getByText("Saved draft: 85 / 100", { exact: true })).toBeVisible();

  // The Student, in their own session, sees no score and no draft.
  const student = await signIn(browser, "student5@e2e.test");
  await student.goto(url);
  const stuGrade = student.getByRole("region", { name: "Grade" });
  await expect(stuGrade.getByText("Not released", { exact: true })).toBeVisible();
  await expect(stuGrade.getByText(/85/)).toHaveCount(0);
  await expect(stuGrade.getByRole("button")).toHaveCount(0);

  // Release with the confirmation, then reload: the server keeps the published score.
  supervisor.once("dialog", (dialog) => {
    expect(dialog.message()).toBe("Release 85 / 100 to the team? Students will see this score.");
    void dialog.accept();
  });
  const released = supervisor.waitForResponse((r) => r.request().method() === "POST" && /\/grade\/release$/.test(r.url()));
  await supGrade.getByRole("button", { name: "Release grade" }).click();
  expect((await released).status()).toBe(200);
  await supervisor.reload();
  await expect(supervisor.getByRole("region", { name: "Grade" }).getByText("Published: 85 / 100", { exact: true })).toBeVisible();

  await student.reload();
  await expect(student.getByRole("region", { name: "Grade" }).getByText("85 / 100", { exact: true })).toBeVisible();
});
