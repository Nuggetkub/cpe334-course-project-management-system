import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { TEST_SCHEMA, baseDatabaseUrl, testDatabaseUrl } from "./test-database.js";

// Runs once before any worker: drop and recreate the test schema, then apply the
// committed migrations. `migrate deploy` (not `migrate dev`) so a test run can
// never invent a migration. Every run starts from the same empty state.
export default async function setup(): Promise<void> {
  // Guard: this drops a schema, so it must never point at real data.
  if (!TEST_SCHEMA || TEST_SCHEMA === "public") {
    throw new Error(`Refusing to reset schema "${TEST_SCHEMA}".`);
  }

  const admin = new PrismaClient({ datasourceUrl: baseDatabaseUrl() });
  try {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${TEST_SCHEMA}"`);
  } finally {
    await admin.$disconnect();
  }

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: "pipe",
  });
}
