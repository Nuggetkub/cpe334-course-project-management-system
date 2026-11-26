import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { E2E_PASSWORD } from "./support";

async function login(page: Page, email: string, nav: "My team" | "My teams") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: nav, exact: true }).click();
}

test("TEST-07.1e Supervisor creates a team and manages an unassigned Student", async ({ page, browser }) => {
  const studentContext = await browser.newContext();
  try {
    const student = await studentContext.newPage();
    await login(student, "student-f07@e2e.test", "My team");
    await expect(student.getByText("You are not assigned to a team yet")).toBeVisible();

    await login(page, "manager-f07@e2e.test", "My teams");
    const team = `E2E F07 ${randomUUID().slice(0, 8)}`;
    await page.getByLabel("Team name", { exact: true }).fill(team);
    await page.getByRole("button", { name: "Create team", exact: true }).click();
    await expect(page.getByRole("heading", { name: `Manage ${team}` })).toBeVisible();
    const managedUrl = page.url();
    await expect(page.getByText("No members listed")).toBeVisible();

    await page.getByLabel("Available student", { exact: true }).selectOption({ label: "E2E F07 Student" });
    await page.getByRole("button", { name: "Add student", exact: true }).click();
    await expect(page.getByRole("button", { name: "Remove E2E F07 Student" })).toBeVisible();
    await student.reload();
    await expect(student.getByRole("heading", { name: team, exact: true })).toBeVisible();
    await expect(student.getByRole("button", { name: /Create team|Add student|Remove/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Remove E2E F07 Student" }).click();
    await expect(page.getByText("Remove E2E F07 Student from this team?")).toBeVisible();
    await page.getByRole("button", { name: "Confirm removal" }).click();
    await expect(page.getByText("No members listed")).toBeVisible();
    await page.getByRole("link", { name: "Back to My teams" }).click();
    await page.getByRole("link", { name: `Manage ${team}` }).click();
    await expect(page).toHaveURL(managedUrl);
    await page.reload();
    await expect(page.getByText("No members listed")).toBeVisible();
    await student.reload();
    await expect(student.getByText("You are not assigned to a team yet")).toBeVisible();
  } finally {
    await studentContext.close();
  }
});
