import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { disconnectPrisma, prisma } from "../src/prisma.js";
import { expectForbidden, expectHidden } from "./support/authz.js";
import { cleanDatabase, createTeamsFixture, signIn } from "./support/teams.js";

const now = new Date("2026-11-05T12:00:00Z");
const app = createApp({ clientDistDir: null, now: () => now });
const valid = { title: "  Prototype  ", description: "  Build it  ", dueAt: "2026-11-08T23:59:00+07:00" };
let f: Awaited<ReturnType<typeof createTeamsFixture>>;
async function as(user: keyof typeof f.users) { return `Bearer ${await signIn(f.users[user].id)}`; }
function list(teamId = f.teamA.id) { return `/api/teams/${teamId}/milestones`; }
async function insert(teamId = f.teamA.id, dueAt = now) {
  return prisma().milestone.create({ data: { teamId, title: "Stored", createdBy: f.users.pA.id, dueAt } });
}
beforeEach(async () => { await cleanDatabase(); f = await createTeamsFixture(); });
afterAll(async () => { try { await cleanDatabase(); } finally { await disconnectPrisma(); } });

describe("F-04 real API and database", () => {
  it("TEST-04.1i persists actual scope/author/time, ignoring forged values, and supports co-supervision", async () => {
    for (const actor of ["pA", "pA2"] as const) {
      const res = await request(app).post(list()).set("Authorization", await as(actor)).send({
        ...valid, teamId: f.teamB.id, createdBy: f.users.sB.id, createdAt: "2000-01-01T00:00:00Z",
      });
      expect(res.status).toBe(201);
      const row = await prisma().milestone.findUniqueOrThrow({ where: { id: res.body.milestone.id } });
      expect(row).toMatchObject({ title: "Prototype", description: "Build it", teamId: f.teamA.id,
        createdBy: f.users[actor].id, createdAt: now, dueAt: new Date("2026-11-08T16:59:00Z") });
      const detail = await request(app).get(`/api/milestones/${row.id}`).set("Authorization", await as("sA"));
      expect(detail.status).toBe(200);
      expect(detail.body).toEqual(res.body);
      expect(Object.keys(res.body.milestone).sort()).toEqual(["id", "teamId", "title", "description", "dueAt", "createdBy", "createdAt", "window", "teamStatus"].sort());
    }
  });

  it("TEST-04.2i rejects invalid fields and nonfuture server-time boundaries without writing", async () => {
    for (const body of [{}, { ...valid, title: " " }, { ...valid, description: "x".repeat(2001) },
      { ...valid, dueAt: now.toISOString() }, { ...valid, dueAt: "2026-11-05T11:59:59Z" },
      { ...valid, dueAt: "2026-11-31T00:00:00Z" }, { ...valid, dueAt: "2026-11-08T12:00:00" }]) {
      const res = await request(app).post(list()).set("Authorization", await as("pA")).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(Object.keys(res.body.error.fields).length).toBeGreaterThan(0);
    }
    expect(await prisma().milestone.count()).toBe(0);
  });

  it("TEST-04.3i reads owned milestones with server-calculated states at the deadline and after it", async () => {
    await insert(f.teamB.id);
    const overdue = await insert(f.teamA.id, new Date(now.getTime() - 1));
    const atDue = await insert();
    const future = await insert(f.teamA.id, new Date(now.getTime() + 1000));
    for (const actor of ["sA", "pA", "pA2"] as const) {
      const res = await request(app).get(list()).set("Authorization", await as(actor));
      expect(res.status).toBe(200);
      expect(res.body.milestones.map((m: { id: number }) => m.id)).toEqual([overdue.id, atDue.id, future.id]);
      expect(res.body.milestones.map((m: { window: string; teamStatus: string }) => [m.window, m.teamStatus]))
        .toEqual([["CLOSED", "OVERDUE"], ["OPEN", "NOT_SUBMITTED"], ["OPEN", "NOT_SUBMITTED"]]);
      expect(res.body.milestones[1].dueAt).toBe(now.toISOString());
    }
  });

  it("TEST-04.7i enforces role and hidden team/detail access", async () => {
    const row = await insert();
    expectForbidden(await request(app).post(list()).set("Authorization", await as("sA")).send(valid));
    for (const actor of ["sB", "s0", "pB"] as const) {
      expectHidden(await request(app).get(list()).set("Authorization", await as(actor)));
      expectHidden(await request(app).get(`/api/milestones/${row.id}`).set("Authorization", await as(actor)));
    }
    expectHidden(await request(app).post(list()).set("Authorization", await as("pB")).send(valid));
    for (const id of ["abc", "0", "01", "2147483648", "999999"]) {
      expectHidden(await request(app).get(`/api/teams/${id}/milestones`).set("Authorization", await as("sA")));
      expectHidden(await request(app).get(`/api/milestones/${id}`).set("Authorization", await as("pA")));
    }
  });

  it("TEST-04.7i checks 401 then 403 then 404 before parsing malformed JSON", async () => {
    for (const [actor, status] of [[null, 401], ["sA", 403], ["pB", 404], ["pA", 400]] as const) {
      const req = request(app).post(list()).set("Content-Type", "application/json");
      if (actor) req.set("Authorization", await as(actor));
      const res = await req.send('{"title":');
      expect(res.status).toBe(status);
    }
    expect(await prisma().milestone.count()).toBe(0);
  });

  it("TEST-04.8i paginates deterministically without another team's rows and validates page after ownership", async () => {
    await prisma().milestone.createMany({ data: Array.from({ length: 51 }, (_, i) => ({
      teamId: f.teamA.id, createdBy: f.users.pA.id, title: `Milestone ${i}`, dueAt: now,
    })) });
    await insert(f.teamB.id);
    const auth = await as("sA");
    const first = await request(app).get(list()).set("Authorization", auth);
    const second = await request(app).get(`${list()}?page=2`).set("Authorization", auth);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ page: 1, pageSize: 50, total: 51 });
    expect(first.body.milestones).toHaveLength(50);
    expect(second.body.milestones).toHaveLength(1);
    const ids = [...first.body.milestones, ...second.body.milestones].map((m: { id: number }) => m.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(51);
    for (const page of ["0", "-1", "abc", "1.2", "99999999999999999999999"]) {
      expect((await request(app).get(`${list()}?page=${page}`).set("Authorization", auth)).status).toBe(400);
      expectHidden(await request(app).get(`${list(f.teamB.id)}?page=${page}`).set("Authorization", auth));
    }
  });

  it("TEST-04.6i distinguishes an authorized empty collection from a hidden team", async () => {
    const res = await request(app).get(list()).set("Authorization", await as("sA"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ milestones: [], page: 1, pageSize: 50, total: 0 });
  });
});
