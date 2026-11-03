import { defineConfig } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { E2E_PASSWORD } from "./e2e/support";

// E2E runs the real API and the real client on their own ports, so it never
// collides with a dev server already running on 3000/5173. The API uses its own
// "cpms_e2e" schema, reset and seeded by server/scripts/e2e-prepare.ts.
const API_PORT = 3101;
const CLIENT_PORT = 4173;
const CLIENT_ORIGIN = `http://127.0.0.1:${CLIENT_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Suites share one schema; keep them serial.
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: [["line"], ["html", { open: "never" }]],

  use: {
    baseURL: CLIENT_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  webServer: [
    {
      command: "npm run e2e:server --prefix server",
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        PORT: String(API_PORT),
        CLIENT_ORIGINS: CLIENT_ORIGIN,
        DATABASE_URL: e2eDatabaseUrl(),
        E2E_PASSWORD,
      },
    },
    {
      command: `npm run dev --prefix client -- --host 127.0.0.1 --port ${CLIENT_PORT} --strictPort`,
      url: CLIENT_ORIGIN,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { VITE_API_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});

/** The normal DATABASE_URL (env, else server/.env) with the schema swapped to cpms_e2e. */
function e2eDatabaseUrl(): string {
  const configured = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? fromServerEnv();
  if (!configured) {
    throw new Error("E2E needs a database. Copy server/.env.example to server/.env, or set E2E_DATABASE_URL.");
  }
  const url = new URL(configured);
  url.searchParams.set("schema", "cpms_e2e");
  return url.toString();
}

function fromServerEnv(): string | undefined {
  if (!existsSync("server/.env")) return undefined;
  const match = readFileSync("server/.env", "utf8").match(/^\s*DATABASE_URL\s*=\s*["']?([^\r\n"']+)["']?\s*$/m);
  return match?.[1];
}
