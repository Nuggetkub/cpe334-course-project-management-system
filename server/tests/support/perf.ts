import type { PrismaClient } from "@prisma/client";

// Shared by the NFR-09 seed and script tests (contract v0.2). Synthetic passwords only.
export const demoEnv = {
  SEED_DEMO_DATA: "true",
  STUDENT_DEMO_PASSWORD: "synthetic-student-test",
  SUPERVISOR_DEMO_PASSWORD: "synthetic-supervisor-test",
};
export const PERF_PASSWORD = "synthetic-perf-test";
export const perfEnv = { SEED_PERF_DATA: "true", PERF_DEMO_PASSWORD: PERF_PASSWORD };

export const two = (n: number) => String(n).padStart(2, "0");
export const PERF_TEAMS = Array.from({ length: 20 }, (_, i) => `Perf Team ${two(i + 1)}`);
export const PERF_MILESTONES = Array.from({ length: 10 }, (_, i) => `Perf milestone ${two(i + 1)}`);
export const perfStudentEmail = (n: number) => `perf.student${two(n)}@example.test`;

export async function wipe(db: PrismaClient): Promise<void> {
  await db.$transaction([
    db.feedback.deleteMany(), db.grade.deleteMany(), db.submission.deleteMany(), db.milestone.deleteMany(),
    db.supervisorTeam.deleteMany(), db.teamMember.deleteMany(), db.team.deleteMany(), db.course.deleteMany(),
    db.session.deleteMany(), db.user.deleteMany(),
  ]);
}

/** Every row of every table the perf seed can write, in a stable order. */
export function snapshot(db: PrismaClient) {
  return db.$transaction([
    db.course.findMany({ orderBy: { id: "asc" } }),
    db.user.findMany({ orderBy: { id: "asc" } }),
    db.team.findMany({ orderBy: { id: "asc" } }),
    db.teamMember.findMany({ orderBy: { studentId: "asc" } }),
    db.supervisorTeam.findMany({ orderBy: [{ supervisorId: "asc" }, { teamId: "asc" }] }),
    db.milestone.findMany({ orderBy: { id: "asc" } }),
    db.submission.findMany({ orderBy: { id: "asc" } }),
    db.feedback.findMany({ orderBy: { id: "asc" } }),
  ]);
}

export async function perfTeam(db: PrismaClient, n: number) {
  return db.team.findFirstOrThrow({ where: { name: PERF_TEAMS[n - 1] } });
}

export async function perfMilestone(db: PrismaClient, team: number, milestone: number) {
  const { id } = await perfTeam(db, team);
  return db.milestone.findFirstOrThrow({ where: { teamId: id, title: PERF_MILESTONES[milestone - 1] } });
}
