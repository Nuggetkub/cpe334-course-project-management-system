import type { Milestone } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { disconnectPrisma, prisma } from "../src/prisma.js";
import { expectForbidden, expectHidden, UNAUTHENTICATED } from "./support/authz.js";
import { cleanDatabase, createTeamsFixture, signIn } from "./support/teams.js";

const initialNow = new Date("2026-11-25T10:00:00.000Z");
const day = 24 * 60 * 60 * 1000;
const relativeDay = (days: number) => new Date(initialNow.getTime() + days * day);
let now = initialNow;
const api = request(createApp({ clientDistDir: null, now: () => now }));
let fixture: Awaited<ReturnType<typeof createTeamsFixture>>;
const path = (id: number | string) => `/api/milestones/${id}/grade`;
type Who = keyof typeof fixture.users;
const tokens = new Map<Who, string>();

async function auth(who: Who) {
  if (!tokens.has(who)) tokens.set(who, `Bearer ${await signIn(fixture.users[who].id)}`);
  return tokens.get(who)!;
}
const read = async (id: number, who: Who) => api.get(path(id)).set("Authorization", await auth(who));
const save = async (id: number, who: Who, body: object) => api.put(path(id)).set("Authorization", await auth(who)).send(body);
// F-10 v0.5: a release names the draft score the Supervisor confirmed.
const release = async (id: number, who: Who, expectedScore?: number) =>
  api.post(`${path(id)}/release`).set("Authorization", await auth(who)).send(expectedScore === undefined ? {} : { expectedScore });

async function milestone(extra: Partial<Pick<Milestone, "dueAt" | "lateUntil" | "closedAt" | "closedBy">> = {}) {
  return prisma().milestone.create({ data: {
    teamId: fixture.teamA.id, title: "Grade milestone", createdBy: fixture.users.pA.id,
    createdAt: relativeDay(-10), dueAt: relativeDay(1), ...extra,
  } });
}

beforeEach(async () => {
  await cleanDatabase();
  fixture = await createTeamsFixture();
  tokens.clear();
  now = initialNow;
});
afterAll(async () => { try { await cleanDatabase(); } finally { await disconnectPrisma(); } });

describe("F-10 grade API", () => {
  it("TEST-10.1i persists one draft, records the authenticated editor, and rejects invalid edits", async () => {
    const m = await milestone();
    const pA = fixture.users.pA;
    const pA2 = fixture.users.pA2;
    const absent = await read(m.id, "pA");
    expect(absent.status).toBe(200);
    expect(absent.body).toEqual({ grade: { draftScore: null, released: false } });
    const created = await save(m.id, "pA", { score: 0, updatedBy: fixture.users.pB.id, releasedScore: 99, teamId: fixture.teamB.id });
    expect(created.status).toBe(200);
    expect(created.body).toEqual({ grade: { draftScore: 0, released: false } });
    expect(await prisma().grade.findUnique({ where: { milestoneId: m.id } })).toMatchObject({
      draftScore: 0, updatedBy: pA.id, updatedAt: now, releasedScore: null,
    });

    now = new Date(initialNow.getTime() + 1_000);
    const updated = await save(m.id, "pA2", { score: 100 });
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual({ grade: { draftScore: 100, released: false } });
    const invalid = await save(m.id, "pA", { score: 101 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toMatchObject({ code: "VALIDATION_ERROR", fields: { score: expect.any(String) } });
    expect(await prisma().grade.findMany()).toEqual([{
      milestoneId: m.id, draftScore: 100, updatedBy: pA2.id, updatedAt: now,
      releasedScore: null, releasedBy: null, releasedAt: null,
    }]);
  });

  it.each(["before deadline", "late window", "after deadline", "manual close"])("TEST-10.1bi grades missing work: %s", async (window) => {
    const m = await milestone(window === "late window" ? { dueAt: relativeDay(-1), lateUntil: relativeDay(1) }
      : window === "after deadline" ? { dueAt: relativeDay(-1) }
      : window === "manual close" ? { closedAt: relativeDay(-1), closedBy: fixture.users.pA.id } : {});
    expect((await save(m.id, "pA", { score: 0 })).status).toBe(200);
    const unpublished = await read(m.id, "sA");
    expect(unpublished.status).toBe(200);
    expect(unpublished.body).toEqual({ grade: { released: false } });
    expect((await release(m.id, "pA", 0)).status).toBe(200);
    expect((await read(m.id, "sA")).body).toEqual({ grade: { released: true, score: 0 } });
    expect(await prisma().milestone.findUnique({ where: { id: m.id } })).toEqual(m);
    expect(await prisma().submission.count({ where: { milestoneId: m.id } })).toBe(0);
  });

  it("TEST-10.2i hides both missing and draft-only grades and publishes a zero score", async () => {
    const m = await milestone();
    const absent = await read(m.id, "sA");
    expect(absent.status).toBe(200);
    expect(absent.body).toEqual({ grade: { released: false } });
    const early = await release(m.id, "pA", 0);
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe("GRADE_NOT_RECORDED");
    expect(await prisma().grade.count()).toBe(0);

    expect((await save(m.id, "pA", { score: 0 })).status).toBe(200);
    const unpublished = await read(m.id, "sA");
    expect(unpublished.status).toBe(200);
    expect(unpublished.text).toBe(absent.text);
    const detail = await api.get(`/api/milestones/${m.id}`).set("Authorization", await auth("sA"));
    expect(detail.status).toBe(200);
    expect(detail.body.milestone).not.toHaveProperty("grade");

    expect((await release(m.id, "pA", 0)).status).toBe(200);
    expect((await read(m.id, "sA")).body).toEqual({ grade: { released: true, score: 0 } });
    expect(await prisma().grade.findUnique({ where: { milestoneId: m.id } })).toMatchObject({
      releasedScore: 0, releasedBy: fixture.users.pA.id, releasedAt: now,
    });
  });

  it("TEST-10.3i keeps a new draft private and preserves the record on repeat release", async () => {
    const m = await milestone();
    expect((await save(m.id, "pA", { score: 70 })).status).toBe(200);
    expect((await release(m.id, "pA", 70)).body).toEqual({ grade: { draftScore: 70, released: true, score: 70, releasedAt: initialNow.toISOString() } });

    now = relativeDay(2);
    const edited = await save(m.id, "pA2", { score: 82 });
    expect(edited.body).toEqual({ grade: { draftScore: 82, released: true, score: 70, releasedAt: initialNow.toISOString() } });
    expect((await read(m.id, "sA")).body).toEqual({ grade: { released: true, score: 70 } });
    const republished = await release(m.id, "pA2", 82);
    expect(republished.status).toBe(200);
    expect(republished.body).toEqual({ grade: { draftScore: 82, released: true, score: 82, releasedAt: now.toISOString() } });
    expect((await read(m.id, "sA")).body).toEqual({ grade: { released: true, score: 82 } });
    const before = await prisma().grade.findUnique({ where: { milestoneId: m.id } });
    expect(before).toMatchObject({ releasedBy: fixture.users.pA2.id, releasedAt: now });

    now = relativeDay(3);
    const repeated = await release(m.id, "pA", 82);
    expect(repeated.status).toBe(200);
    expect(repeated.body).toEqual(republished.body);
    expect(await prisma().grade.findUnique({ where: { milestoneId: m.id } })).toEqual(before);
  });

  it("TEST-10.3di refuses a release confirmed for an older draft and changes nothing", async () => {
    const m = await milestone();
    expect((await save(m.id, "pA", { score: 70 })).status).toBe(200); // pA's screen now shows draft 70
    expect((await save(m.id, "pA2", { score: 82 })).status).toBe(200); // the co-supervisor changes it
    const stale = await release(m.id, "pA", 70);
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("GRADE_DRAFT_CHANGED");
    expect(await prisma().grade.findUnique({ where: { milestoneId: m.id } })).toMatchObject({
      draftScore: 82, releasedScore: null, releasedBy: null, releasedAt: null,
    });
    expect((await read(m.id, "sA")).body).toEqual({ grade: { released: false } });

    const confirmed = await release(m.id, "pA", 82);
    expect(confirmed.status).toBe(200);
    expect((await read(m.id, "sA")).body).toEqual({ grade: { released: true, score: 82 } });
  });

  it("TEST-10.3di validates expectedScore and the JSON body after scope, without changing the grade", async () => {
    const m = await milestone();
    expect((await save(m.id, "pA", { score: 70 })).status).toBe(200);
    const bodies: object[] = [{}, { expectedScore: 70.5 }, { expectedScore: "70" }, { expectedScore: -1 }, { expectedScore: 101 }, { expectedScore: null }];
    for (const body of bodies) {
      const res = await api.post(`${path(m.id)}/release`).set("Authorization", await auth("pA")).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", fields: { expectedScore: expect.any(String) } });
    }
    const malformed = await api.post(`${path(m.id)}/release`).set("Authorization", await auth("pA")).type("json").send("{");
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("BAD_REQUEST");
    expectHidden(await api.post(`${path(m.id)}/release`).set("Authorization", await auth("pB")).type("json").send("{"));
    expect(await prisma().grade.findUnique({ where: { milestoneId: m.id } })).toMatchObject({ releasedScore: null });
  });

  it("TEST-10.4i enforces 401 → 403 → masked 404 → 400 without changing the grade", async () => {
    const m = await milestone();
    const malformed = (id: number | string) => api.put(path(id)).type("json").send("{");
    const anonymous = await malformed(m.id);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual(UNAUTHENTICATED);
    expectForbidden(await malformed(m.id).set("Authorization", await auth("sA")));
    expectForbidden(await release(m.id, "sA", 70));

    const absentId = 2_147_483_647;
    for (const method of ["get", "put", "post"] as const) {
      const target = (id: number | string) => `${path(id)}${method === "post" ? "/release" : ""}`;
      const hidden = await api[method](target(m.id)).set("Authorization", await auth("pB"));
      const missing = await api[method](target(absentId)).set("Authorization", await auth("pA"));
      const malformedId = await api[method](target("01")).set("Authorization", await auth("pA"));
      for (const response of [hidden, missing, malformedId]) expectHidden(response);
      expect(hidden.text).toBe(missing.text);
    }
    expectHidden(await read(m.id, "sB"));
    expectHidden(await read(m.id, "s0"));
    expectHidden(await malformed(m.id).set("Authorization", await auth("pB")));
    const badPayload = await malformed(m.id).set("Authorization", await auth("pA"));
    expect(badPayload.status).toBe(400);
    expect(badPayload.body.error.code).toBe("BAD_REQUEST");
    expect(await prisma().grade.count()).toBe(0);
  });

  it("TEST-10.1ci enforces grade bounds and complete release snapshots in PostgreSQL itself", async () => {
    const m = await milestone();
    const actor = fixture.users.pA.id;
    const insert = (draft: number, score: number | null, releasedBy: number | null, releasedAt: Date | null) => prisma().$executeRaw`
      INSERT INTO grades (milestone_id, draft_score, updated_by, updated_at, released_score, released_by, released_at)
      VALUES (${m.id}, ${draft}, ${actor}, ${now}, ${score}, ${releasedBy}, ${releasedAt})
    `;
    for (const [constraint, result] of [
      ["grades_draft_score_range", () => insert(101, null, null, null)],
      ["grades_released_score_range", () => insert(0, -1, actor, now)],
      ["grades_release_snapshot_complete", () => insert(0, 0, null, now)],
      ["grades_release_snapshot_complete", () => insert(0, null, actor, null)],
    ] as const) {
      await expect(result()).rejects.toMatchObject({ code: "P2010", meta: { code: "23514", message: expect.stringContaining(constraint) } });
    }
    expect(await prisma().grade.count()).toBe(0);
    await expect(insert(0, 0, actor, now)).resolves.toBe(1);
  });
});
