import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],

    // Reset and migrate an isolated PostgreSQL schema once per run, so the suite
    // never touches the development database and never depends on local data
    // (CI runs it against a fresh Postgres service).
    globalSetup: ["tests/global-setup.ts"],

    // Point each worker's PrismaClient at that schema before any test imports it.
    setupFiles: ["tests/setup-env.ts"],

    // Suites share one schema; serial runs keep them from seeing each other's rows.
    fileParallelism: false,
  },
});
