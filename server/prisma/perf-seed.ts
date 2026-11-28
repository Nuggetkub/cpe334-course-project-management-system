import type { PrismaClient } from "@prisma/client";

// NFR-09 contract v0.2 §2: the opt-in scaled seed. RED stub: the tests define the behaviour.

export const PERF_SUPERVISOR_EMAIL = "perf.supervisor@example.test";

export function readPerfSeedConfig(_env: NodeJS.ProcessEnv): { password: string } | null {
  throw new Error("Not implemented (NFR-09 RED).");
}

export async function seedPerf(_db: PrismaClient, _env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  throw new Error("Not implemented (NFR-09 RED).");
}
