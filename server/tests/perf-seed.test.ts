import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { SeedError, seedDemo, seedFailureMessage } from "../prisma/demo-seed.js";
import { PERF_SUPERVISOR_EMAIL, readPerfSeedConfig, seedPerf } from "../prisma/perf-seed.js";
import { createApp } from "../src/app.js";
import { disconnectPrisma } from "../src/prisma.js";
import {
  PERF_MILESTONES, PERF_PASSWORD, PERF_TEAMS, demoEnv, perfEnv, perfMilestone, perfStudentEmail, perfTeam, snapshot, two, wipe,
} from "./support/perf.js";

// NFR-09 contract v0.2 §2: AC-P.1 (TEST-P.1i) and AC-P.2 (TEST-P.2i).
const db = new PrismaClient();
const app = createApp({ clientDistDir: null });

afterEach(() => wipe(db));
afterAll(async () => {
  await db.$disconnect();
  await disconnectPrisma();
});

async function token(email: string, password: string): Promise<string> {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token;
}

/** What the demo accounts see; must not change when the perf data is added. */
async function demoView() {
  const view: Record<string, unknown> = {};
  for (const n of [1, 2]) {
    const auth = `Bearer ${await token(`supervisor${n}@example.test`, demoEnv.SUPERVISOR_DEMO_PASSWORD)}`;
    const teams = await request(app).get("/api/teams").set("Authorization", auth);
    const overview = await request(app).get("/api/overview").set("Authorization", auth);
    const candidates = await request(app).get(`/api/teams/${teams.body.teams[0].id}/member-candidates`).set("Authorization", auth);
    view[`supervisor${n}`] = { teams: teams.body, overview: overview.body, candidates: candidates.body };
  }
  for (const n of [1, 3]) {
    const auth = `Bearer ${await token(`student${n}@example.test`, demoEnv.STUDENT_DEMO_PASSWORD)}`;
    view[`student${n}`] = (await request(app).get("/api/teams/mine").set("Authorization", auth)).body;
  }
  return view;
}

/** The step must fail with a safe SeedError that names the rule, never the row's data. */
async function expectSafeRejection(pattern: RegExp): Promise<void> {
  const error = await seedPerf(db, perfEnv).then(() => null, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(SeedError);
  const message = seedFailureMessage(error);
  expect(message).toMatch(pattern);
  expect(message).not.toMatch(/@|Perf Team \d|Perf milestone \d/);
  expect(message).not.toContain(PERF_PASSWORD);
}

describe("NFR-09 perf seed", () => {
  it("TEST-P.1i writes the exact fixture, is idempotent and leaves the demo accounts' pages unchanged", async () => {
    await seedDemo(db, demoEnv);
    const before = await demoView();
    const now = Date.now();

    expect(await seedPerf(db, perfEnv)).toBe(true);

    const course = await db.course.findUniqueOrThrow({ where: { code: "CPE334-DEMO" } });
    expect(await db.course.count()).toBe(1);
    const supervisor = await db.user.findUniqueOrThrow({ where: { email: PERF_SUPERVISOR_EMAIL } });
    expect(supervisor).toMatchObject({ role: "SUPERVISOR", name: "Perf Supervisor" });
    expect(supervisor.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);

    const teams = await db.team.findMany({
      where: { name: { startsWith: "Perf Team " } }, orderBy: { name: "asc" },
      include: {
        members: { include: { student: true } }, supervisors: true,
        milestones: { orderBy: { title: "asc" }, include: { submissions: { orderBy: { version: "asc" }, include: { feedback: true } } } },
      },
    });
    expect(teams.map((t) => t.name)).toEqual(PERF_TEAMS);
    let submissions = 0;
    let feedback = 0;
    teams.forEach((team, i) => {
      expect(team.courseId).toBe(course.id);
      expect(team.supervisors.map((s) => s.supervisorId)).toEqual([supervisor.id]);
      expect(team.members.map((m) => m.student)).toEqual([
        expect.objectContaining({ email: perfStudentEmail(i + 1), name: `Perf Student ${two(i + 1)}`, role: "STUDENT" }),
      ]);
      const student = team.members[0].studentId;
      expect(team.milestones.map((m) => m.title)).toEqual(PERF_MILESTONES);
      team.milestones.forEach((m, j) => {
        expect(m.dueAt.getTime() < now).toBe(j < 5);
        expect(m.closedAt).toBeNull();
        const versions = j === 0 ? [1, 2, 3, 4, 5] : j < 6 ? [1] : [];
        expect(m.submissions.map((s) => s.version)).toEqual(versions);
        for (const s of m.submissions) {
          expect(s.submittedBy).toBe(student);
          const latest = s.version === versions.at(-1);
          expect(s.feedback.map((f) => f.supervisorId)).toEqual(latest && j < 3 ? [supervisor.id] : []);
        }
        submissions += m.submissions.length;
        feedback += m.submissions.reduce((sum, s) => sum + s.feedback.length, 0);
      });
    });
    expect(teams.flatMap((t) => t.milestones)).toHaveLength(200);
    expect([submissions, feedback]).toEqual([200, 60]);
    expect(await db.user.count({ where: { email: { startsWith: "perf." } } })).toBe(21);

    // The overview shows Awaiting and Received (60 each) across its 4 pages.
    const auth = `Bearer ${await token(PERF_SUPERVISOR_EMAIL, PERF_PASSWORD)}`;
    const states: string[] = [];
    for (const page of [1, 2, 3, 4]) {
      const response = await request(app).get(`/api/overview?page=${page}`).set("Authorization", auth);
      expect(response.body).toMatchObject({ total: 200 });
      states.push(...response.body.rows.map((r: { feedbackState: string }) => r.feedbackState));
    }
    expect(states.filter((s) => s === "RECEIVED")).toHaveLength(60);
    expect(states.filter((s) => s === "AWAITING")).toHaveLength(60);
    await db.session.deleteMany();

    const first = await snapshot(db);
    expect(await seedPerf(db, { ...perfEnv, PERF_DEMO_PASSWORD: "a-different-password" })).toBe(true);
    expect(await snapshot(db)).toEqual(first);
    await db.session.deleteMany();
    expect(await demoView()).toEqual(before);
  }, 120000);

  it("TEST-P.1i a run after a partial one adds only what is missing", async () => {
    await seedDemo(db, demoEnv);
    await seedPerf(db, perfEnv);
    const team = await perfTeam(db, 12);
    await db.milestone.deleteMany({ where: { teamId: team.id, submissions: { none: {} } } });
    const kept = await db.milestone.findMany({ where: { teamId: team.id }, orderBy: { id: "asc" } });
    expect(kept).toHaveLength(6);

    await seedPerf(db, perfEnv);
    const after = await db.milestone.findMany({ where: { teamId: team.id }, orderBy: { id: "asc" } });
    expect(after.slice(0, 6)).toEqual(kept);
    expect(after.map((m) => m.title).sort()).toEqual(PERF_MILESTONES);
    expect(await db.milestone.count()).toBe(200);
  }, 120000);
});

describe("NFR-09 perf seed: inputs and conflicts", () => {
  it("TEST-P.2i is off unless SEED_PERF_DATA=true and rejects bad inputs without writing", async () => {
    await seedDemo(db, demoEnv);
    const before = await snapshot(db);
    expect(readPerfSeedConfig({})).toBeNull();
    expect(await seedPerf(db, {})).toBe(false);
    expect(await seedPerf(db, { SEED_PERF_DATA: "false", PERF_DEMO_PASSWORD: PERF_PASSWORD })).toBe(false);
    expect(readPerfSeedConfig(perfEnv)).toEqual({ password: PERF_PASSWORD });

    const flag = /^SEED_PERF_DATA must be true or false\.$/;
    const password = /^PERF_DEMO_PASSWORD must be nonblank and at most 72 UTF-8 bytes\.$/;
    for (const [env, pattern] of [
      [{ SEED_PERF_DATA: "yes", PERF_DEMO_PASSWORD: PERF_PASSWORD }, flag],
      [{ SEED_PERF_DATA: "true" }, password],
      [{ SEED_PERF_DATA: "true", PERF_DEMO_PASSWORD: "   " }, password],
      [{ SEED_PERF_DATA: "true", PERF_DEMO_PASSWORD: "ก".repeat(25) }, password],
    ] as const) {
      const error = await seedPerf(db, env).then(() => null, (caught: unknown) => caught);
      expect(error).toBeInstanceOf(SeedError);
      expect(seedFailureMessage(error)).toMatch(pattern);
    }
    expect(await snapshot(db)).toEqual(before);
  });

  it("TEST-P.2i fails without writing when the CPE334-DEMO course is missing, and never creates one", async () => {
    await expectSafeRejection(/CPE334-DEMO/);
    expect(await db.course.count()).toBe(0);
    expect(await db.user.count()).toBe(0);
  }, 60000);

  it("TEST-P.2i aborts when a reserved email belongs to the wrong role or name", async () => {
    await seedDemo(db, demoEnv);
    await db.user.create({ data: { email: PERF_SUPERVISOR_EMAIL, name: "Perf Supervisor", role: "STUDENT", passwordHash: "fixture" } });
    let before = await snapshot(db);
    await expectSafeRejection(/role/i);
    expect(await snapshot(db)).toEqual(before);

    await db.user.delete({ where: { email: PERF_SUPERVISOR_EMAIL } });
    await db.user.create({ data: { email: perfStudentEmail(7), name: "Someone Else", role: "STUDENT", passwordHash: "fixture" } });
    before = await snapshot(db);
    await expectSafeRejection(/name/i);
    expect(await snapshot(db)).toEqual(before);
  }, 60000);

  it("TEST-P.2i aborts on a wrong membership, Supervisor assignment, milestone or submission", async () => {
    await seedDemo(db, demoEnv);
    await seedPerf(db, perfEnv);
    const demoA = await db.team.findFirstOrThrow({ where: { name: "Demo Team A" } });
    const demoB = await db.team.findFirstOrThrow({ where: { name: "Demo Team B" } });
    const supervisor1 = await db.user.findUniqueOrThrow({ where: { email: "supervisor1@example.test" } });
    const perfSupervisor = await db.user.findUniqueOrThrow({ where: { email: PERF_SUPERVISOR_EMAIL } });
    const student5 = await db.user.findUniqueOrThrow({ where: { email: perfStudentEmail(5) } });
    const team7 = await perfTeam(db, 7);
    const team20 = await perfTeam(db, 20);

    const cases: Array<[string, RegExp, () => Promise<unknown>, () => Promise<unknown>]> = [
      ["another Supervisor on a Perf team", /Supervisor/,
        () => db.supervisorTeam.create({ data: { supervisorId: supervisor1.id, teamId: team7.id } }),
        () => db.supervisorTeam.delete({ where: { supervisorId_teamId: { supervisorId: supervisor1.id, teamId: team7.id } } })],
      ["the Perf Supervisor on a team outside the Perf set", /Supervisor/,
        () => db.supervisorTeam.create({ data: { supervisorId: perfSupervisor.id, teamId: demoB.id } }),
        () => db.supervisorTeam.delete({ where: { supervisorId_teamId: { supervisorId: perfSupervisor.id, teamId: demoB.id } } })],
      ["a Perf Student moved to another team", /member|team/i,
        () => db.teamMember.update({ where: { studentId: student5.id }, data: { teamId: demoA.id } }),
        async () => db.teamMember.update({ where: { studentId: student5.id }, data: { teamId: (await perfTeam(db, 5)).id } })],
      ["an extra milestone on a Perf team", /milestone/i,
        () => db.milestone.create({ data: { teamId: team20.id, createdBy: perfSupervisor.id, title: "Extra", dueAt: new Date() } }),
        () => db.milestone.deleteMany({ where: { title: "Extra" } })],
      ["an extra submission version", /submission|version/i,
        async () => db.submission.create({ data: {
          milestoneId: (await perfMilestone(db, 3, 1)).id, version: 6, title: "Extra", link: "https://example.com/extra",
          submittedBy: (await db.user.findUniqueOrThrow({ where: { email: perfStudentEmail(3) } })).id, submittedAt: new Date(),
        } }),
        () => db.submission.deleteMany({ where: { version: 6 } })],
    ];
    for (const [name, pattern, apply, undo] of cases) {
      await apply();
      const before = await snapshot(db);
      await expectSafeRejection(pattern).catch((error: Error) => {
        throw new Error(`${name}: ${error.message}`);
      });
      expect(await snapshot(db), name).toEqual(before);
      await undo();
    }
    // With every conflict undone, the rerun is a no-op again.
    const valid = await snapshot(db);
    await seedPerf(db, perfEnv);
    expect(await snapshot(db)).toEqual(valid);
  }, 120000);

  it("TEST-P.2i rolls back: a conflict found after other Perf rows were checked leaves no partial data", async () => {
    // Fresh: only "Perf Team 20" exists, with a demo Student on it. Nothing else may be created.
    await seedDemo(db, demoEnv);
    const course = await db.course.findUniqueOrThrow({ where: { code: "CPE334-DEMO" } });
    const team20 = await db.team.create({ data: { courseId: course.id, name: PERF_TEAMS[19] } });
    const student3 = await db.user.findUniqueOrThrow({ where: { email: "student3@example.test" } });
    await db.teamMember.update({ where: { studentId: student3.id }, data: { teamId: team20.id } });
    let before = await snapshot(db);
    await expectSafeRejection(/member|Student/i);
    expect(await snapshot(db)).toEqual(before);
    await wipe(db);

    // Partial: Perf Team 12 lacks milestones 07–10, and Perf Team 20 has another Supervisor.
    // The missing rows come earlier in the order, but none may be written.
    await seedDemo(db, demoEnv);
    await seedPerf(db, perfEnv);
    const team12 = await perfTeam(db, 12);
    await db.milestone.deleteMany({ where: { teamId: team12.id, submissions: { none: {} } } });
    const supervisor1 = await db.user.findUniqueOrThrow({ where: { email: "supervisor1@example.test" } });
    await db.supervisorTeam.create({ data: { supervisorId: supervisor1.id, teamId: (await perfTeam(db, 20)).id } });
    before = await snapshot(db);
    await expectSafeRejection(/Supervisor/);
    expect(await snapshot(db)).toEqual(before);
    expect(await db.milestone.count({ where: { teamId: team12.id } })).toBe(6);
  }, 120000);
});
