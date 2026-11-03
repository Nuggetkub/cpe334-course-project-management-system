// Prepares the database for the Playwright run (`npm run e2e:server`): drops and
// recreates the E2E schema, applies the committed migrations and creates one
// Student and one Supervisor. Never touches the "public" schema.
//
// The E2E password comes from E2E_PASSWORD (set by playwright.config.ts). It
// only ever exists in a throw-away schema on a developer or CI database.

import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const E2E_SCHEMA = "cpms_e2e";

const url = process.env.DATABASE_URL;
const password = process.env.E2E_PASSWORD;
if (!url || !password) throw new Error("e2e-prepare needs DATABASE_URL and E2E_PASSWORD");

const schema = new URL(url).searchParams.get("schema");
if (schema !== E2E_SCHEMA) {
  throw new Error(`Refusing to reset schema "${schema}" — e2e-prepare only resets "${E2E_SCHEMA}".`);
}

const prisma = new PrismaClient();
try {
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${E2E_SCHEMA}" CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${E2E_SCHEMA}"`);
  execSync("npx prisma migrate deploy", { stdio: "pipe" });

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.createMany({
    data: [
      { email: "student@e2e.test", name: "E2E Student", role: "STUDENT", passwordHash },
      { email: "supervisor@e2e.test", name: "E2E Supervisor", role: "SUPERVISOR", passwordHash },
    ],
  });
  console.log(`[e2e] schema "${E2E_SCHEMA}" reset, migrated and seeded`);
} finally {
  await prisma.$disconnect();
}
