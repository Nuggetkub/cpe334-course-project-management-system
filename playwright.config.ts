import { defineConfig } from "@playwright/test";

// E2E runs the real API and the real client on their own ports, so it never
// collides with a dev server already running on 3000/5173.
const API_PORT = 3101;
const CLIENT_PORT = 4173;
const CLIENT_ORIGIN = `http://127.0.0.1:${CLIENT_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Later suites create rows in one shared schema; keep them serial.
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
      command: "npm run dev --prefix server",
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { PORT: String(API_PORT), CLIENT_ORIGINS: CLIENT_ORIGIN },
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
