import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { disconnectPrisma, prisma } from "../src/prisma.js";
import { expectForbidden, expectHidden, UNAUTHENTICATED } from "./support/authz.js";
import { cleanDatabase, createTeamsFixture, signIn } from "./support/teams.js";

// F-08 contract §3 and §4: real API and PostgreSQL with a fixed server clock.
const now = new Date("2026-11-25T12:00:00Z");
const D = new Date("2026-11-27T12:00:00Z"); // now + 2 d
const app = createApp({ clientDistDir: null, now: () => now });
const CLOSED = { error: { code: "MILESTONE_CLOSED", message: "This milestone is closed." } };
let f: Awaited<ReturnType<typeof createTeamsFixture>>;
async function as(user: keyof typeof f.users) { return `Bearer ${await signIn(f.users[user].id)}`; }
async function milestone(data: { teamId?: number; dueAt?: Date; lateUntil?: Date | null; closedAt?: Date | null } = {}) {
  return prisma().milestone.create({ data: {
    teamId: data.teamId ?? f.teamA.id, title: "Stored", description: "Old", createdBy: f.users.pA.id,
    dueAt: data.dueAt ?? D, lateUntil: data.lateUntil ?? null, closedAt: data.closedAt ?? null,
    closedBy: data.closedAt ? f.users.pA.id : null,
  } });
}
const row = (id: number) => prisma().milestone.findUniqueOrThrow({ where: { id } });
const patch = (id: number | string, auth: string, body: unknown) =>
  request(app).patch(`/api/milestones/${id}`).set("Authorization", auth).send(body as object);
const close = (id: number | string, auth: string) => request(app).post(`/api/milestones/${id}/close`).set("Authorization", auth);

beforeEach(async () => { await cleanDatabase(); f = await createTeamsFixture(); });
afterAll(async () => { try { await cleanDatabase(); } finally { await disconnectPrisma(); } });

describe("F-08 real API and database", () => {
  it("TEST-08.1i edits title and description for assigned supervisors and co-supervisors", async () => {
    const m = await milestone();
    for (const [actor, title] of [["pA", "  First  "], ["pA2", "Second"]] as const) {
      const res = await patch(m.id, await as(actor), { title, description: "  New text  ", teamId: f.teamB.id, closedAt: "2000-01-01T00:00:00Z" });
      expect(res.status).toBe(200);
      expect(res.body.milestone).toMatchObject({ id: m.id, title: title.trim(), description: "New text", lateUntil: null, closedAt: null, closedBy: null, window: "OPEN" });
      const detail = await request(app).get(`/api/milestones/${m.id}`).set("Authorization", await as("sA"));
      expect(detail.body.milestone.title).toBe(title.trim());
    }
    expect(await row(m.id)).toMatchObject({ teamId: f.teamA.id, dueAt: D, lateUntil: null, closedAt: null });
  });

  it("TEST-08.1i saves a title only, sending neither date, on an open milestone with a late window and on a closed one", async () => {
    const L = new Date(D.getTime() + 3600 * 1000);
    const open = await milestone({ lateUntil: L });
    const closed = await milestone({ closedAt: now });
    const auth = await as("pA");
    for (const m of [open, closed]) {
      const res = await patch(m.id, auth, { title: "Only the title" });
      expect(res.status).toBe(200);
      expect(await row(m.id)).toMatchObject({ title: "Only the title", dueAt: D, lateUntil: m.lateUntil, closedAt: m.closedAt });
    }
  });

  it("TEST-08.2i extends only later and at least 24 h ahead (BR-13, BR-05)", async () => {
    const m1 = await milestone();
    const auth = await as("pA");
    const later = new Date(D.getTime() + 24 * 3600 * 1000);
    expect((await patch(m1.id, auth, { dueAt: later.toISOString() })).status).toBe(200);
    expect((await row(m1.id)).dueAt).toEqual(later);
    for (const dueAt of [later, new Date(later.getTime() - 3600 * 1000)]) {
      const res = await patch(m1.id, auth, { dueAt: dueAt.toISOString() });
      expect(res.status).toBe(400);
      expect(res.body.error.fields).toEqual({ dueAt: "The new due date must be later than the current one." });
      expect((await row(m1.id)).dueAt).toEqual(later);
    }
    const m2 = await milestone({ dueAt: new Date(now.getTime() + 3600 * 1000) });
    const short = await patch(m2.id, auth, { dueAt: "2026-11-26T11:59:59Z" });
    expect(short.status).toBe(400);
    expect(short.body.error.fields).toEqual({ dueAt: "Enter a due date at least 24 hours from now." });
    expect((await row(m2.id)).dueAt).toEqual(new Date(now.getTime() + 3600 * 1000));
    expect((await patch(m2.id, auth, { dueAt: "2026-11-26T12:00:00Z" })).status).toBe(200);
    expect((await row(m2.id)).dueAt).toEqual(new Date("2026-11-26T12:00:00Z"));
  });

  it("TEST-08.3i sets, rejects and removes a late window (BR-12)", async () => {
    const m = await milestone();
    const auth = await as("pA");
    const L = new Date(D.getTime() + 3600 * 1000);
    const set = await patch(m.id, auth, { lateUntil: L.toISOString() });
    expect(set.status).toBe(200);
    expect(set.body.milestone.lateUntil).toBe(L.toISOString());
    const same = await patch(m.id, auth, { lateUntil: D.toISOString() });
    expect(same.status).toBe(400);
    expect(same.body.error.fields).toEqual({ lateUntil: "The late window must end after the due date." });
    const beyond = await patch(m.id, auth, { dueAt: new Date(L.getTime() + 1000).toISOString() });
    expect(beyond.status).toBe(400);
    expect(beyond.body.error.fields).toEqual({ lateUntil: "The late window must end after the due date." });
    expect(await row(m.id)).toMatchObject({ dueAt: D, lateUntil: L });
    const removed = await patch(m.id, auth, { lateUntil: null });
    expect(removed.status).toBe(200);
    expect((await row(m.id)).lateUntil).toBeNull();
  });

  it("TEST-08.4i closes once with server time and blocks date changes afterwards (FR-11)", async () => {
    const m = await milestone();
    const auth = await as("pA2");
    const res = await close(m.id, auth);
    expect(res.status).toBe(200);
    expect(res.body.milestone).toMatchObject({ window: "CLOSED", teamStatus: "NOT_SUBMITTED", closedAt: now.toISOString(), closedBy: f.users.pA2.id });
    expect(await row(m.id)).toMatchObject({ closedAt: now, closedBy: f.users.pA2.id });
    const again = await close(m.id, auth);
    expect(again.status).toBe(409);
    expect(again.body).toEqual(CLOSED);
    for (const body of [{ dueAt: "2026-12-01T00:00:00Z" }, { lateUntil: "2026-11-28T00:00:00Z" }]) {
      const blocked = await patch(m.id, auth, body);
      expect(blocked.status).toBe(409);
      expect(blocked.body).toEqual(CLOSED);
    }
    expect(await row(m.id)).toMatchObject({ dueAt: D, lateUntil: null, closedAt: now });
    const renamed = await patch(m.id, auth, { title: "Renamed after close" });
    expect(renamed.status).toBe(200);
    expect((await row(m.id)).title).toBe("Renamed after close");
  });

  it("TEST-08.6i rejects submissions to a closed milestone and keeps existing work readable (BR-11)", async () => {
    const future = await milestone({ closedAt: now });
    const student = await as("sA");
    const res = await request(app).post(`/api/milestones/${future.id}/submissions`).set("Authorization", student)
      .send({ title: "Work", link: "https://example.com/w" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(CLOSED);
    expect(await prisma().submission.count()).toBe(0);
    // A milestone closed after the team submitted and got feedback: everything stays readable.
    const done = await milestone();
    const sub = await prisma().submission.create({ data: { milestoneId: done.id, title: "Done", link: "https://example.com/d", submittedBy: f.users.sA.id, submittedAt: now } });
    await prisma().feedback.create({ data: { submissionId: sub.id, supervisorId: f.users.pA.id, text: "Good", createdAt: now } });
    expect((await close(done.id, await as("pA"))).status).toBe(200);
    const read = await request(app).get(`/api/milestones/${done.id}/submission`).set("Authorization", student);
    expect(read.status).toBe(200);
    expect(read.body.submission.title).toBe("Done");
    expect(read.body.milestone).toMatchObject({ window: "CLOSED", teamStatus: "SUBMITTED" });
    const fb = await request(app).get(`/api/submissions/${sub.id}/feedback`).set("Authorization", student);
    expect(fb.status).toBe(200);
    expect(JSON.stringify(fb.body)).toContain("Good");
  });

  it("TEST-08.7i applies 401 → 403 → 404 → 400 with no writes, and has no delete (BR-14)", async () => {
    const m = await milestone();
    const mB = await milestone({ teamId: f.teamB.id });
    const anon = await request(app).patch(`/api/milestones/${m.id}`).send({ title: "x" });
    expect(anon.status).toBe(401);
    expect(anon.body).toEqual(UNAUTHENTICATED);
    expect((await request(app).post(`/api/milestones/${m.id}/close`)).status).toBe(401);
    for (const s of ["sA", "sB", "s0"] as const) {
      expectForbidden(await patch(m.id, await as(s), { title: "x" }));
      expectForbidden(await close(m.id, await as(s)));
    }
    const pB = await as("pB");
    expectHidden(await patch(m.id, pB, { title: "x" }));
    expectHidden(await close(m.id, pB));
    const pA = await as("pA");
    for (const id of [mB.id, 999999, "abc", "0", "1e3"]) {
      expectHidden(await patch(id, pA, { title: "x" }));
      expectHidden(await close(id, pA));
    }
    const bad = await request(app).patch(`/api/milestones/${m.id}`).set("Authorization", pA)
      .set("Content-Type", "application/json").send("{bad json");
    expect(bad.status).toBe(400);
    const hiddenBad = await request(app).patch(`/api/milestones/${mB.id}`).set("Authorization", pA)
      .set("Content-Type", "application/json").send("{bad json");
    expectHidden(hiddenBad);
    expectHidden(await request(app).delete(`/api/milestones/${m.id}`).set("Authorization", pA));
    expect(await row(m.id)).toMatchObject({ title: "Stored", description: "Old", dueAt: D, lateUntil: null, closedAt: null });
    expect(await row(mB.id)).toMatchObject({ title: "Stored", closedAt: null });
    expect(await prisma().milestone.count()).toBe(2);
  });
});
