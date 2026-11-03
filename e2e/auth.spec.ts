import { expect, test } from "@playwright/test";
import { E2E_PASSWORD } from "./support";

test("TEST-01.7b student signs in, sees Student navigation, logs out and is locked out", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill("student@e2e.test");
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("E2E Student")).toBeVisible();
  await expect(page.getByRole("link", { name: "My team" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Milestones" })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.goto("/milestones");
  await expect(page).toHaveURL(/\/login$/);
});

test("TEST-01.8b wrong password shows the generic message", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill("supervisor@e2e.test");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toHaveText("Email or password is incorrect");
});
