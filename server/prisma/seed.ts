// Seed entry point (`npm run prisma:seed`). CI and the Cloud Run migration job run
// it after `prisma migrate deploy`, so it must be safe to run repeatedly.
//
// Issue #8 fills it in: upsert-only (idempotent), demo passwords read from env
// vars, never hard-coded.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("[seed] nothing to seed yet (Issue #8)");
}

main()
  .catch((error: unknown) => {
    console.error("[seed] failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
