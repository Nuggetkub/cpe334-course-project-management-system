import type { PrismaClient, Role } from "@prisma/client";
import { hashPassword, passwordTooLong } from "../src/auth/password.js";

export class SeedError extends Error {}

export function readSeedConfig(env: NodeJS.ProcessEnv) {
  if (env.SEED_DEMO_DATA === undefined || env.SEED_DEMO_DATA === "false") return null;
  if (env.SEED_DEMO_DATA !== "true") throw new SeedError("SEED_DEMO_DATA must be true or false.");

  function password(key: string) {
    const value = env[key];
    if (!value?.trim() || passwordTooLong(value)) {
      throw new SeedError(`${key} must be nonblank and at most 72 UTF-8 bytes.`);
    }
    return value;
  }

  return {
    studentPassword: password("STUDENT_DEMO_PASSWORD"),
    supervisorPassword: password("SUPERVISOR_DEMO_PASSWORD"),
  };
}

export async function seedDemo(db: PrismaClient, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const config = readSeedConfig(env);
  if (!config) return false;

  const fixtures: Array<{ email: string; name: string; role: Role; team: number | null }> = [
    ...[1, 2, 3, 4].map((n) => ({
      email: `student${n}@example.test`, name: `Demo Student ${n}`, role: "STUDENT" as const, team: n <= 2 ? 0 : 1,
    })),
    ...[1, 2].map((n) => ({
      email: `supervisor${n}@example.test`, name: `Demo Supervisor ${n}`, role: "SUPERVISOR" as const, team: n - 1,
    })),
    { email: "smoke.student@example.test", name: "Smoke Test Student", role: "STUDENT", team: null },
  ];
  // Separate salt per account; don't hold a database transaction during hashing.
  const accounts = await Promise.all(fixtures.map(async ({ team, ...identity }) => ({
    team,
    identity: {
      ...identity,
      passwordHash: await hashPassword(identity.role === "STUDENT" ? config.studentPassword : config.supervisorPassword),
    },
  })));

  await db.$transaction(async (tx) => {
    const course = await tx.course.upsert({
      where: { code: "CPE334-DEMO" },
      create: { code: "CPE334-DEMO", name: "CPE 334 Demo Offering" },
      update: {},
    });
    const teams = [];
    for (const name of ["Demo Team A", "Demo Team B"]) {
      const key = { courseId: course.id, name };
      teams.push(await tx.team.upsert({ where: { courseId_name: key }, create: key, update: {} }));
    }
    for (const { identity, team } of accounts) {
      const user = await tx.user.upsert({ where: { email: identity.email }, create: identity, update: {} });
      if (user.role !== identity.role) throw new SeedError("Demo account role conflict.");
      if (team === null) {
        if (await tx.teamMember.findUnique({ where: { studentId: user.id } })) {
          throw new SeedError("Smoke Student must have no team membership.");
        }
      } else if (identity.role === "STUDENT") {
        const teamId = teams[team].id;
        const membership = await tx.teamMember.upsert({
          where: { studentId: user.id }, create: { studentId: user.id, teamId }, update: {},
        });
        if (membership.teamId !== teamId) throw new SeedError("Demo Student membership conflict.");
      } else {
        const key = { supervisorId: user.id, teamId: teams[team].id };
        await tx.supervisorTeam.upsert({ where: { supervisorId_teamId: key }, create: key, update: {} });
      }
    }
  }, { timeout: 15000 });
  return true;
}
