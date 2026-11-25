import { expect, type Page } from "@playwright/test";

// Password of the users created by server/scripts/e2e-prepare.ts. Not a
// secret: it only exists in the throw-away "cpms_e2e" schema of a dev/CI database.
export const E2E_PASSWORD = "e2e-Only-Passw0rd";

/**
 * Signs in through the real form and opens Milestones. Shared by the journeys (D-11).
 * The login request is awaited on its own, under the test timeout, because the server's bcrypt check
 * can take a while on a busy machine; only then is the 5 s UI wait used for the signed-in shell.
 */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  const login = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/auth/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await login).status()).toBe(200);
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.getByRole("link", { name: "Milestones", exact: true }).click();
}
