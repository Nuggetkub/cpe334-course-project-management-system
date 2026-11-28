import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedDemo } from "../prisma/demo-seed.js";
import { PERF_SUPERVISOR_EMAIL, seedPerf } from "../prisma/perf-seed.js";
import { runPerf, type PerfOptions, type PerfReport } from "../scripts/perf-nfr09-lib.js";
import { createApp } from "../src/app.js";
import { disconnectPrisma } from "../src/prisma.js";
import { PERF_PASSWORD, demoEnv, perfEnv, perfMilestone, perfTeam, wipe } from "./support/perf.js";

// NFR-09 contract v0.2 §3, AC-P.4 (TEST-P.4i): the timing script against the app on a local port.
const db = new PrismaClient();
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createApp({ clientDistDir: null, commit: "perf-test-commit" }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(async () => {
  await wipe(db);
  await seedDemo(db, demoEnv);
  await seedPerf(db, perfEnv);
}, 60000);
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await wipe(db);
  await db.$disconnect();
  await disconnectPrisma();
});

async function run(overrides: Partial<PerfOptions> = {}) {
  const lines: string[] = [];
  const outcome = await runPerf({
    baseUrl, email: PERF_SUPERVISOR_EMAIL, password: PERF_PASSWORD, cold: "warm",
    now: () => new Date("2026-12-10T03:00:00Z"), log: (line) => lines.push(line), ...overrides,
  });
  const output = [outcome.markdown, JSON.stringify(outcome.json), ...lines].join("\n");
  // Never the password, a session token (43 base64url characters) or a response body.
  expect(output).not.toContain(PERF_PASSWORD);
  expect(output).not.toMatch(/[A-Za-z0-9_-]{43}/);
  expect(output).not.toMatch(/"rows"|"submissions"|passwordHash/);
  return outcome;
}

async function expectStopped(pattern: RegExp) {
  const outcome = await run();
  expect(outcome.exitCode).toBe(2);
  expect(outcome.json).toEqual({ error: expect.stringMatching(pattern) });
  expect(outcome.markdown).not.toMatch(/PASS/);
  expect(outcome.markdown).toMatch(/no result/i);
}

describe("NFR-09 timing script", () => {
  it("TEST-P.4i reports E1–E3 with 50 timed samples each, the checks passed and the cold start apart", async () => {
    const outcome = await run();
    const report = outcome.json as PerfReport;
    expect(report).toMatchObject({
      date: "2026-12-10 10:00 ICT", baseUrl, commit: "perf-test-commit",
      cold: { ms: expect.any(Number), state: "warm" }, checks: { passed: true },
    });
    expect(report.endpoints.map((e) => [e.id, e.n])).toEqual([["E1", 50], ["E2", 50], ["E3", 50]]);
    expect(report.endpoints[0].path).toMatch(/^\/api\/teams\/\d+\/milestones$/);
    expect(report.endpoints[1].path).toMatch(/^\/api\/milestones\/\d+\/submissions$/);
    expect(report.endpoints[2].path).toBe("/api/overview");
    for (const e of report.endpoints) {
      expect(e.min).toBeLessThanOrEqual(e.median);
      expect(e.median).toBeLessThanOrEqual(e.p95);
      expect(e.p95).toBeLessThanOrEqual(e.max);
      expect(e.verdict).toBe(e.p95 < 500 ? "PASS" : "FAIL");
    }
    const allPass = report.endpoints.every((e) => e.verdict === "PASS");
    expect(report.overall).toBe(allPass ? "PASS" : "FAIL");
    expect(outcome.exitCode).toBe(allPass ? 0 : 1);
    for (const text of ["E1", "E2", "E3", "nearest-rank", "perf-test-commit", "Cold start", "2026-12-10 10:00 ICT"]) {
      expect(outcome.markdown).toContain(text);
    }
    // Signed out at the end.
    const supervisor = await db.user.findUniqueOrThrow({ where: { email: PERF_SUPERVISOR_EMAIL } });
    expect(await db.session.count({ where: { userId: supervisor.id } })).toBe(0);
  }, 120000);

  it("TEST-P.4i stops when the overview total isn't 200", async () => {
    await db.milestone.delete({ where: { id: (await perfMilestone(db, 20, 10)).id } });
    await expectStopped(/overview|milestone/i);
  }, 120000);

  it("TEST-P.4i stops when the total is 200 but one Perf team is swapped for another team", async () => {
    const supervisor = await db.user.findUniqueOrThrow({ where: { email: PERF_SUPERVISOR_EMAIL } });
    const team20 = await perfTeam(db, 20);
    const other = await db.team.create({ data: { courseId: team20.courseId, name: "Other Team" } });
    await db.milestone.createMany({ data: Array.from({ length: 10 }, (_, i) => ({
      teamId: other.id, createdBy: supervisor.id, title: `Other ${i}`, dueAt: new Date(Date.now() + 86400000),
    })) });
    await db.supervisorTeam.create({ data: { supervisorId: supervisor.id, teamId: other.id } });
    await db.supervisorTeam.delete({ where: { supervisorId_teamId: { supervisorId: supervisor.id, teamId: team20.id } } });
    expect(await db.milestone.count({ where: { team: { supervisors: { some: { supervisorId: supervisor.id } } } } })).toBe(200);
    await expectStopped(/team/i);
  }, 120000);

  it("TEST-P.4i stops when the total is 200 but one submission is missing", async () => {
    await db.submission.deleteMany({ where: { milestoneId: (await perfMilestone(db, 20, 6)).id } });
    expect(await db.milestone.count()).toBe(200);
    await expectStopped(/submission/i);
  }, 120000);

  it("TEST-P.4i stops when the feedback count is wrong", async () => {
    const latest = await db.submission.findFirstOrThrow({ where: { milestoneId: (await perfMilestone(db, 9, 2)).id } });
    await db.feedback.deleteMany({ where: { submissionId: latest.id } });
    await expectStopped(/feedback/i);
  }, 120000);

  it("TEST-P.4i stops on a failed sign-in", async () => {
    const outcome = await run({ password: "not-the-perf-password" });
    expect(outcome.exitCode).toBe(2);
    expect(outcome.markdown).not.toMatch(/PASS/);
  }, 60000);
});
