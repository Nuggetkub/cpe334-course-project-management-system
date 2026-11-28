import type { PrismaClient } from "@prisma/client";
import { hashPassword, passwordTooLong } from "../src/auth/password.js";
import { SeedError } from "./demo-seed.js";

// NFR-09 contract v0.3 §2: the opt-in scaled seed (20 teams, 200 milestones, 200 submissions,
// 60 feedback entries) inside the demo course. Every reserved row is checked before any write,
// and the checks and writes share one transaction, so a conflict leaves the database unchanged.

export const PERF_SUPERVISOR_EMAIL = "perf.supervisor@example.test";
const COURSE_CODE = "CPE334-DEMO";
const TEAMS = 20;
const MILESTONES = 10;
const PAST = 5;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const two = (n: number) => String(n).padStart(2, "0");
const teamName = (t: number) => `Perf Team ${two(t)}`;
const milestoneTitle = (m: number) => `Perf milestone ${two(m)}`;
/** Versions of milestone m (1-based): 01 has 1–5, 02–06 have 1, 07–10 have none. */
const versionsOf = (m: number) => (m === 1 ? [1, 2, 3, 4, 5] : m <= 6 ? [1] : []);
/** Milestones 01–03 have one feedback entry on their latest version. */
const hasFeedback = (m: number) => m <= 3;

interface Account { email: string; name: string; role: "STUDENT" | "SUPERVISOR" }
const SUPERVISOR: Account = { email: PERF_SUPERVISOR_EMAIL, name: "Perf Supervisor", role: "SUPERVISOR" };
const STUDENTS: Account[] = Array.from({ length: TEAMS }, (_, i) => ({
  email: `perf.student${two(i + 1)}@example.test`, name: `Perf Student ${two(i + 1)}`, role: "STUDENT",
}));
const ACCOUNTS = [SUPERVISOR, ...STUDENTS];

export function readPerfSeedConfig(env: NodeJS.ProcessEnv): { password: string } | null {
  if (env.SEED_PERF_DATA === undefined || env.SEED_PERF_DATA === "false") return null;
  if (env.SEED_PERF_DATA !== "true") throw new SeedError("SEED_PERF_DATA must be true or false.");
  const password = env.PERF_DEMO_PASSWORD;
  if (!password?.trim() || passwordTooLong(password)) {
    throw new SeedError("PERF_DEMO_PASSWORD must be nonblank and at most 72 UTF-8 bytes.");
  }
  return { password };
}

const conflict = (rule: string) => new SeedError(`Perf seed conflict: ${rule}. Nothing was written.`);
const missingCourse = () => new SeedError(`The perf seed needs the ${COURSE_CODE} course from the demo seed. Nothing was written.`);

export async function seedPerf(db: PrismaClient, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const config = readPerfSeedConfig(env);
  if (!config) return false;
  if (!(await db.course.findUnique({ where: { code: COURSE_CODE } }))) throw missingCourse();

  // Hash only for accounts that don't exist yet, outside the transaction; a separate salt each.
  const existing = new Set((await db.user.findMany({
    where: { email: { in: ACCOUNTS.map((a) => a.email) } }, select: { email: true },
  })).map((u) => u.email));
  const hashes = new Map(await Promise.all(ACCOUNTS.filter((a) => !existing.has(a.email))
    .map(async (a) => [a.email, await hashPassword(config.password)] as const)));

  await db.$transaction(async (tx) => {
    const course = await tx.course.findUnique({ where: { code: COURSE_CODE } });
    if (!course) throw missingCourse();

    // 1. Read and check every reserved row. No writes until all checks pass.
    const users = new Map((await tx.user.findMany({ where: { email: { in: ACCOUNTS.map((a) => a.email) } } }))
      .map((u) => [u.email, u]));
    for (const account of ACCOUNTS) {
      const user = users.get(account.email);
      if (!user) {
        if (!hashes.has(account.email)) throw new SeedError("The Perf accounts changed during the seed. Nothing was written; run it again.");
        continue;
      }
      if (user.role !== account.role) throw conflict("a reserved Perf account has another role");
      if (user.name !== account.name) throw conflict("a reserved Perf account has another name");
    }
    const supervisor = users.get(SUPERVISOR.email);
    const studentIds = STUDENTS.map((s) => users.get(s.email)?.id ?? null);

    const teams = await tx.team.findMany({
      where: { courseId: course.id, name: { in: Array.from({ length: TEAMS }, (_, i) => teamName(i + 1)) } },
      include: { members: true, supervisors: true, milestones: { include: { submissions: { include: { feedback: true } } } } },
    });
    const byName = new Map(teams.map((t) => [t.name, t]));
    const perfTeamIds = new Set(teams.map((t) => t.id));

    if (supervisor) {
      const assigned = await tx.supervisorTeam.findMany({ where: { supervisorId: supervisor.id } });
      if (assigned.some((a) => !perfTeamIds.has(a.teamId))) throw conflict("the Perf Supervisor supervises a team outside the Perf set");
    }
    const now = Date.now();
    for (let t = 1; t <= TEAMS; t++) {
      const studentId = studentIds[t - 1];
      const team = byName.get(teamName(t));
      if (studentId !== null) {
        const membership = await tx.teamMember.findUnique({ where: { studentId } });
        if (membership && membership.teamId !== team?.id) throw conflict("a Perf Student is on another team");
      }
      if (!team) continue;
      if (team.supervisors.some((s) => s.supervisorId !== supervisor?.id)) throw conflict("a Perf team has another Supervisor");
      if (team.members.some((m) => m.studentId !== studentId)) throw conflict("a Perf team has another member");
      const titles = new Set<string>();
      for (const milestone of team.milestones) {
        const m = Array.from({ length: MILESTONES }, (_, i) => milestoneTitle(i + 1)).indexOf(milestone.title) + 1;
        if (m === 0 || titles.has(milestone.title)) throw conflict("a Perf team has a milestone outside the fixture");
        titles.add(milestone.title);
        if ((milestone.dueAt.getTime() < now) !== (m <= PAST)) throw conflict("a Perf milestone has a due date on the wrong side of now");
        const expected = versionsOf(m);
        for (const submission of milestone.submissions) {
          if (!expected.includes(submission.version)) throw conflict("a Perf milestone has an unexpected submission version");
          if (submission.submittedBy !== studentId) throw conflict("a Perf submission is by another account");
          const feedbackHere = hasFeedback(m) && submission.version === expected.at(-1);
          if (submission.feedback.length > (feedbackHere ? 1 : 0) || submission.feedback.some((f) => f.supervisorId !== supervisor?.id)) {
            throw conflict("a Perf submission has unexpected feedback");
          }
        }
      }
    }

    // 2. Add only what is missing. Existing rows are never changed or deleted.
    const ensureUser = async (account: Account) => users.get(account.email)
      ?? tx.user.create({ data: { ...account, passwordHash: hashes.get(account.email)! } });
    const supervisorId = (await ensureUser(SUPERVISOR)).id;
    for (let t = 1; t <= TEAMS; t++) {
      const studentId = (await ensureUser(STUDENTS[t - 1])).id;
      const found = byName.get(teamName(t));
      const team = found ?? { ...(await tx.team.create({ data: { courseId: course.id, name: teamName(t) } })), members: [], supervisors: [], milestones: [] };
      if (team.supervisors.length === 0) await tx.supervisorTeam.create({ data: { supervisorId, teamId: team.id } });
      if (team.members.length === 0) await tx.teamMember.create({ data: { studentId, teamId: team.id } });

      for (let m = 1; m <= MILESTONES; m++) {
        const milestone = team.milestones.find((row) => row.title === milestoneTitle(m)) ?? {
          ...(await tx.milestone.create({ data: {
            teamId: team.id, createdBy: supervisorId, title: milestoneTitle(m),
            dueAt: new Date(m <= PAST ? now - (PAST + 1 - m) * DAY : now + (60 + m) * DAY),
          } })),
          submissions: [],
        };
        const versions = versionsOf(m);
        const submittedBase = Math.min(milestone.dueAt.getTime(), now) - 6 * HOUR;
        for (const version of versions) {
          const submission = milestone.submissions.find((s) => s.version === version) ?? {
            ...(await tx.submission.create({ data: {
              milestoneId: milestone.id, version, title: `Perf submission v${version}`,
              link: `https://example.com/perf/${two(t)}/${two(m)}/v${version}`,
              submittedBy: studentId, submittedAt: new Date(submittedBase + version * HOUR),
            } })),
            feedback: [],
          };
          if (hasFeedback(m) && version === versions.at(-1) && submission.feedback.length === 0) {
            await tx.feedback.create({ data: {
              submissionId: submission.id, supervisorId, text: "Perf feedback.",
              createdAt: new Date(submission.submittedAt.getTime() + 10 * 60 * 1000),
            } });
          }
        }
      }
    }
  }, { timeout: 60000, maxWait: 10000 });
  return true;
}
