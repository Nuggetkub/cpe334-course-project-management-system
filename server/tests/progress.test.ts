import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { disconnectPrisma, prisma } from "../src/prisma.js";
import { expectHidden, UNAUTHENTICATED } from "./support/authz.js";
import { cleanDatabase, createTeamsFixture, signIn } from "./support/teams.js";

// F-11 contract v0.3 §3 and §4: real API and PostgreSQL with a fixed server clock.
const NOW = new Date("2026-11-28T12:00:00Z");
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000);
const app = createApp({ clientDistDir: null, now: () => NOW });
let f: Awaited<ReturnType<typeof createTeamsFixture>>;
type Who = keyof typeof f.users;
const tokens = new Map<number, string>();
async function auth(who: Who) {
  const id = f.users[who].id;
  if (!tokens.has(id)) tokens.set(id, await signIn(id));
  return `Bearer ${tokens.get(id)}`;
}
const progress = async (who: Who | null, teamId: number | string, query = "") => {
  const req = request(app).get(`/api/teams/${teamId}/progress${query}`);
  return who ? req.set("Authorization", await auth(who)) : req;
};
async function milestone(title: string, dueAt: Date, extra: { teamId?: number; lateUntil?: Date; closedAt?: Date } = {}) {
  return prisma().milestone.create({ data: {
    teamId: extra.teamId ?? f.teamA.id, title, dueAt, createdBy: f.users.pA.id, createdAt: hours(-200),
    lateUntil: extra.lateUntil ?? null, closedAt: extra.closedAt ?? null, closedBy: extra.closedAt ? f.users.pA.id : null,
  } });
}
async function version(milestoneId: number, v: number, at: Date, late = false) {
  return prisma().submission.create({ data: {
    milestoneId, version: v, late, title: `Work v${v}`, link: `https://example.com/v${v}`, submittedBy: f.users.sA.id, submittedAt: at,
  } });
}
async function feedback(submissionId: number) {
  return prisma().feedback.create({ data: { submissionId, supervisorId: f.users.pA.id, text: "Looks good", createdAt: hours(-1) } });
}

beforeEach(async () => {
  await cleanDatabase();
  tokens.clear();
  f = await createTeamsFixture();
});
afterAll(async () => { await disconnectPrisma(); });

describe("F-11 progress board", () => {
  it("TEST-11.1i returns one row per team A milestone, in due order, with the F-04 window and team status", async () => {
    // The five AC-11.1 states, created out of due order.
    const closed = await milestone("Closed by supervisor", hours(48), { closedAt: hours(-2) });
    const future = await milestone("Due in the future", hours(24));
    const overdue = await milestone("Overdue, nothing submitted", hours(-48));
    const onTime = await milestone("Submitted on time", hours(-24));
    await version(onTime.id, 1, hours(-30));
    const late = await milestone("Latest version late", hours(-6), { lateUntil: hours(6) });
    await version(late.id, 1, hours(-10));
    await version(late.id, 2, hours(-1), true);
    await milestone("Team B milestone", hours(1), { teamId: f.teamB.id });

    const res = await progress("sA", f.teamA.id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ team: { id: f.teamA.id, name: "Team A" }, page: 1, pageSize: 50, total: 5 });
    expect(res.body.rows.map((r: { milestoneId: number }) => r.milestoneId)).toEqual([overdue.id, onTime.id, late.id, future.id, closed.id]);
    expect(JSON.stringify(res.body)).not.toContain("Team B milestone");

    const list = await request(app).get(`/api/teams/${f.teamA.id}/milestones`).set("Authorization", await auth("sA"));
    expect(list.status).toBe(200);
    const pick = (m: { window: string; teamStatus: string }) => ({ window: m.window, teamStatus: m.teamStatus });
    expect(res.body.rows.map(pick)).toEqual(list.body.milestones.map(pick));
    expect(res.body.rows.map(pick)).toEqual([
      { window: "CLOSED", teamStatus: "OVERDUE" },
      { window: "CLOSED", teamStatus: "SUBMITTED" },
      { window: "LATE", teamStatus: "LATE" },
      { window: "OPEN", teamStatus: "NOT_SUBMITTED" },
      { window: "CLOSED", teamStatus: "NOT_SUBMITTED" },
    ]);

    const lateRow = res.body.rows[2];
    expect(lateRow).toEqual({
      milestoneId: late.id, title: "Latest version late", dueAt: hours(-6).toISOString(), window: "LATE", teamStatus: "LATE",
      latest: { version: 2, late: true, submittedAt: hours(-1).toISOString() }, feedbackStatus: "AWAITING",
    });
    expect(res.body.rows[0]).toMatchObject({ latest: null, feedbackStatus: "NONE" });
    // Phase 1 (contract v0.3): no row has a grade key.
    for (const row of res.body.rows) expect(row).not.toHaveProperty("grade");
  });

  it("TEST-11.2i shows the latest version and its own feedback status: AWAITING, then RECEIVED", async () => {
    const m = await milestone("Two versions", hours(-6), { lateUntil: hours(6) });
    const v1 = await version(m.id, 1, hours(-10));
    await feedback(v1.id);
    await version(m.id, 2, hours(-1), true);

    const first = await progress("sA", f.teamA.id);
    expect(first.body.rows[0]).toMatchObject({ latest: { version: 2, late: true }, feedbackStatus: "AWAITING" });

    const v2 = await prisma().submission.findUniqueOrThrow({ where: { milestoneId_version: { milestoneId: m.id, version: 2 } } });
    const added = await request(app).post(`/api/submissions/${v2.id}/feedback`).set("Authorization", await auth("pA")).send({ text: "Thanks for v2" });
    expect(added.status).toBe(201);

    const second = await progress("sA", f.teamA.id);
    expect(second.body.rows[0]).toMatchObject({ latest: { version: 2, late: true }, feedbackStatus: "RECEIVED" });
  });

  it("TEST-11.4i answers 401, then the fixed 404 for hidden or missing scope, without team A data", async () => {
    await milestone("Secret team A title", hours(24));

    const anonymous = await progress(null, f.teamA.id);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual(UNAUTHENTICATED);

    const hidden = [
      await progress("sB", f.teamA.id),
      await progress("s0", f.teamA.id),
      await progress("pB", f.teamA.id),
      await progress("sA", "abc"),
      await progress("sA", f.teamB.id + 1000),
    ];
    for (const res of hidden) {
      expectHidden(res);
      expect(JSON.stringify(res.body)).not.toContain("Secret team A title");
    }

    // Assigned Supervisor and co-supervisor read the board (read-only).
    for (const who of ["pA", "pA2"] as const) {
      const res = await progress(who, f.teamA.id);
      expect(res.status).toBe(200);
      expect(res.body.rows.map((r: { title: string }) => r.title)).toEqual(["Secret team A title"]);
    }
  });

  it("TEST-11.5i pages 51 milestones with tied due dates in dueAt/id order and rejects an invalid page after the ownership check", async () => {
    const created = [];
    for (let i = 0; i < 51; i += 1) created.push(await milestone(`M${i}`, hours(24 + Math.floor(i / 10))));
    const expected = [...created].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || a.id - b.id).map((m) => m.id);

    const one = await progress("sA", f.teamA.id, "?page=1");
    const two = await progress("sA", f.teamA.id, "?page=2");
    expect(one.status).toBe(200);
    expect(one.body).toMatchObject({ page: 1, pageSize: 50, total: 51 });
    expect(two.body).toMatchObject({ page: 2, pageSize: 50, total: 51 });
    expect(one.body.rows).toHaveLength(50);
    expect(two.body.rows).toHaveLength(1);
    expect([...one.body.rows, ...two.body.rows].map((r: { milestoneId: number }) => r.milestoneId)).toEqual(expected);

    for (const bad of ["0", "abc", "-1", "1.5"]) {
      const res = await progress("sA", f.teamA.id, `?page=${bad}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", fields: { page: expect.any(String) } });
    }
    // Ownership first: a hidden team with a bad page is still the fixed 404.
    expectHidden(await progress("sB", f.teamA.id, "?page=abc"));
  });

  it("TEST-11.5i returns 200 with no rows for a team without milestones", async () => {
    const res = await progress("sA", f.teamA.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ team: { id: f.teamA.id, name: "Team A" }, rows: [], page: 1, pageSize: 50, total: 0 });
  });
});
