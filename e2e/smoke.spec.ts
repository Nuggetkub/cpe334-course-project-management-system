import { expect, test } from "@playwright/test";

// Scaffold smoke test: the browser loads the client and the client reaches the API.
test("home page loads and reports the API as ok", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Course Project Management System" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("API: ok");
});
