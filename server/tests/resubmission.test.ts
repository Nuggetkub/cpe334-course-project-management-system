import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { disconnectPrisma, prisma } from "../src/prisma.js";
import { expectForbidden, expectHidden, UNAUTHENTICATED } from "./support/authz.js";
import { cleanDatabase, createTeamsFixture, signIn } from "./support/teams.js";
import { createUser } from "./support/users.js";

// F-09 contract §3 and §4: real API and PostgreSQL; the server clock is moved per test.
const D = new Date("2026-11-28T12:00:00Z");
const L = new Date("2026-11-28T18:00:00Z");
let clock = new Date(D.getTime() - 3600 * 1000);
const app = createApp({ clientDistDir: null, now: () => clock });
const body = { title: "Work", link: "https://example.com/work" };
let f: Awaited<ReturnType<typeof createTeamsFixture>>;
let sA2: Awaited<ReturnType<typeof createUser>>;
type Who = keyof typeof f.users | "sA2";
const tokens = new Map<number, string>();
async function auth(who: Who) {
  const id = who === "sA2" ? sA2.id : f.users[who].id;
  if (!tokens.has(id)) tokens.set(id, await signIn(id));
  return `Bearer ${tokens.get(id)}`;
}
async function milestone(data: { teamId?: number; dueAt?: Date; lateUntil?: Date | null; closedAt?: Date | null } = {}) {
  return prisma().milestone.create({ data: {
    teamId: data.teamId ?? f.teamA.id, title: `M ${Math.random()}`, createdBy: f.users.pA.id,
    dueAt: data.dueAt ?? D, lateUntil: data.lateUntil ?? null, closedAt: data.closedAt ?? null,
    closedBy: data.closedAt ? f.users.pA.id : null,
  } });
}
async function v1(milestoneId: number) {
  return prisma().submission.create({ data: { milestoneId, version: 1, title: "First", link: "https://example.com/v1", submittedBy: f.users.sA.id, submittedAt: new Date(D.getTime() - 7200 * 1000) } });
}
const submit = async (who: Who, id: number | string, b: object = body) =>
  request(app).post(`/api/milestones/${id}/submissions`).set("Authorization", await auth(who)).send(b);
const history = async (who: Who, id: number | string) =>
  request(app).get(`/api/milestones/${id}/submissions`).set("Authorization", await auth(who));
const rows = (milestoneId: number) => prisma().submission.findMany({ where: { milestoneId }, orderBy: { version: "asc" } });

beforeEach(async () => {
  await cleanDatabase();
  tokens.clear();
  clock = new Date(D.getTime() - 3600 * 1000);
  f = await createTeamsFixture();
  sA2 = await createUser("STUDENT");
  await prisma().teamMember.create({ data: { studentId: sA2.id, teamId: f.teamA.id } });
});
afterAll(async () => { try { await cleanDatabase(); } finally { await disconnectPrisma(); } });

describe("F-09 real API and database", () => {
  it("TEST-09.1i creates version N+1 while the window is open and never changes earlier versions (replaces TEST-05.4a)", async () => {
    const m = await milestone();
    const first = await v1(m.id);
    const r2 = await submit("sA2", m.id, { title: "Second", link: "https://example.com/v2" });
    expect(r2.status).toBe(201);
    expect(r2.body.submission).toMatchObject({ version: 2, late: false, title: "Second", submittedBy: { id: sA2.id } });
    const r3 = await submit("sA", m.id);
    expect(r3.status).toBe(201);
    expect(r3.body.submission).toMatchObject({ version: 3, late: false });
    const all = await rows(m.id);
    expect(all.map((r) => r.version)).toEqual([1, 2, 3]);
    expect(all[0]).toEqual(first);
  });

  it("TEST-09.2i accepts first and new versions in the late window as Late, up to late_until inclusive", async () => {
    const m = await milestone({ lateUntil: L });
    clock = new Date(D.getTime() + 1000);
    const r1 = await submit("sA", m.id);
    expect(r1.status).toBe(201);
    expect(r1.body.submission).toMatchObject({ version: 1, late: true });
    clock = L;
    const r2 = await submit("sA2", m.id);
    expect(r2.status).toBe(201);
    expect(r2.body.submission).toMatchObject({ version: 2, late: true });
    clock = new Date(L.getTime() + 1);
    const r3 = await submit("sA", m.id);
    expect(r3.status).toBe(409);
    expect(r3.body).toEqual({ error: { code: "DEADLINE_PASSED", message: "The deadline for this milestone has passed." } });
    expect(await rows(m.id)).toHaveLength(2);
    const read = await request(app).get(`/api/milestones/${m.id}/submission`).set("Authorization", await auth("sA"));
    expect(read.body.milestone.teamStatus).toBe("LATE");
    expect(read.body.submission).toMatchObject({ version: 2, late: true });
  });

  it("TEST-09.3i rejects a closed milestone and a passed deadline without a late window", async () => {
    const closed = await milestone({ closedAt: new Date(D.getTime() - 7200 * 1000) });
    const res1 = await submit("sA", closed.id);
    expect(res1.status).toBe(409);
    expect(res1.body).toEqual({ error: { code: "MILESTONE_CLOSED", message: "This milestone is closed." } });
    const passed = await milestone({ dueAt: new Date(D.getTime() - 7200 * 1000) });
    await v1(passed.id);
    const res2 = await submit("sA", passed.id);
    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe("DEADLINE_PASSED");
    expect(await rows(closed.id)).toHaveLength(0);
    expect(await rows(passed.id)).toHaveLength(1);
  });

  it("TEST-09.4i shows the full history newest-first to the team and its supervisors only", async () => {
    const m = await milestone();
    await v1(m.id);
    await submit("sA", m.id);
    await submit("sA2", m.id);
    for (const who of ["sA", "sA2", "pA", "pA2"] as const) {
      const res = await history(who, m.id);
      expect(res.status).toBe(200);
      expect(res.body.submissions.map((s: { version: number }) => s.version)).toEqual([3, 2, 1]);
      expect(res.body.submissions[0]).toMatchObject({ late: false, submittedBy: { id: sA2.id } });
      expect(res.body.milestone.id).toBe(m.id);
    }
    for (const who of ["sB", "s0", "pB"] as const) expectHidden(await history(who, m.id));
    const empty = await milestone();
    expect((await history("sA", empty.id)).body.submissions).toEqual([]);
  });

  it("TEST-09.5i keeps feedback on the version it was written for", async () => {
    const m = await milestone();
    const first = await v1(m.id);
    await prisma().feedback.create({ data: { submissionId: first.id, supervisorId: f.users.pA.id, text: "On version 1", createdAt: clock } });
    const r2 = await submit("sA", m.id);
    const r3 = await submit("sA", m.id);
    const feedback = async (id: number) => (await request(app).get(`/api/submissions/${id}/feedback`).set("Authorization", await auth("sA"))).body.feedback;
    expect((await feedback(first.id)).map((x: { text: string }) => x.text)).toEqual(["On version 1"]);
    expect(await feedback(r2.body.submission.id)).toEqual([]);
    expect(await feedback(r3.body.submission.id)).toEqual([]);
  });

  it("TEST-09.6i gives two simultaneous submissions consecutive versions (replaces TEST-05.4b)", async () => {
    const m = await milestone();
    await v1(m.id);
    const results = await Promise.all([submit("sA", m.id), submit("sA2", m.id)]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(results.map((r) => r.body.submission.version).sort()).toEqual([2, 3]);
    expect((await rows(m.id)).map((r) => r.version)).toEqual([1, 2, 3]);
  });

  it("TEST-09.7i applies 401 → 403 → 404 → 400 with no writes", async () => {
    const m = await milestone();
    const mB = await milestone({ teamId: f.teamB.id });
    const anon = await request(app).post(`/api/milestones/${m.id}/submissions`).send(body);
    expect(anon.status).toBe(401);
    expect(anon.body).toEqual(UNAUTHENTICATED);
    expect((await request(app).get(`/api/milestones/${m.id}/submissions`)).status).toBe(401);
    expectForbidden(await submit("pA", m.id));
    expectHidden(await submit("sB", m.id));
    expectHidden(await submit("sA", mB.id));
    expectHidden(await submit("sA", "abc"));
    expectHidden(await history("sA", "999999"));
    const bad = await request(app).post(`/api/milestones/${m.id}/submissions`).set("Authorization", await auth("sA"))
      .set("Content-Type", "application/json").send("{bad json");
    expect(bad.status).toBe(400);
    expect(await prisma().submission.count()).toBe(0);
  });
});
