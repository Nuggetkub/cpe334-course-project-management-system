// Seed entry point (`npm run prisma:seed`). CI and the Cloud Run migration job run
// it after `prisma migrate deploy`, so it must be safe to run repeatedly.

import { PrismaClient } from "@prisma/client";
import { seedDemo, seedFailureMessage } from "./demo-seed.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const enabled = await seedDemo(prisma);
  console.log(enabled ? "[seed] Demo fixtures ready." : "[seed] Demo data disabled.");
}

main()
  .catch((error: unknown) => {
    // Raw Prisma errors may contain write inputs, including hashes.
    console.error("[seed]", seedFailureMessage(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
