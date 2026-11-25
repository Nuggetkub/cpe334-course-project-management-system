import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { closeMilestone, updateMilestone } from "../src/milestones/service.js";
import { disconnectPrisma, prisma } from "../src/prisma.js";
import { createSubmission } from "../src/submissions/service.js";
import { cleanDatabase, createTeamsFixture, signIn } from "./support/teams.js";

// F-08 contract v0.4 §1 "Concurrency" and §4 TEST-08.9i / TEST-08.10i.
const now = new Date("2026-11-25T12:00:00Z");
const D = new Date("2026-11-27T12:00:00Z"); // original due date, now + 2 d
const X = new Date("2026-11-29T12:00:00Z"); // the competing transaction's later due date
const DAY = 24 * 3600 * 1000;
const app = createApp({ clientDistDir: null, now: () => now });
const work = { title: "Work", description: "", link: "https://example.com/w" };
let f: Awaited<ReturnType<typeof createTeamsFixture>>;

const milestone = (data: { closedAt?: Date } = {}) => prisma().milestone.create({ data: {
  teamId: f.teamA.id, title: "Race", createdBy: f.users.pA.id, dueAt: D,
  closedAt: data.closedAt ?? null, closedBy: data.closedAt ? f.users.pA.id : null,
} });
const row = (id: number) => prisma().milestone.findUniqueOrThrow({ where: { id } });

/** A second transaction locks the milestone row, changes it, and keeps the lock for `ms` before committing. */
async function holdLock(id: number, data: { dueAt?: Date; closedAt?: Date; closedBy?: number }, ms = 1500) {
  let locked!: () => void;
  const ready = new Promise<void>((resolve) => { locked = resolve; });
  const committed = prisma().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM milestones WHERE id = ${id} FOR UPDATE`;
    await tx.milestone.update({ where: { id }, data });
    locked();
    await new Promise((resolve) => setTimeout(resolve, ms));
  }, { timeout: 10000 });
  await ready;
  // Wrapped: returning the promise itself from this async function would make callers wait for the commit.
  return { committed };
}
const outcome = (p: Promise<unknown>) => p.then(() => ({ ok: true as const }), (error) => ({ ok: false as const, error }));

beforeEach(async () => {
  await cleanDatabase();
  f = await createTeamsFixture();
  // Open several pooled connections first, so the write under test never waits for a new connection
  // while the lock holder runs (that would let the holder commit first and hide the race).
  await Promise.all(Array.from({ length: 4 }, () => prisma().$executeRaw`SELECT pg_sleep(0.05)`));
});
afterAll(async () => { try { await cleanDatabase(); } finally { await disconnectPrisma(); } });

describe("F-08 concurrency and precedence", () => {
  it("TEST-08.9i returns MILESTONE_CLOSED before ALREADY_SUBMITTED, and keeps ALREADY_SUBMITTED when not closed", async () => {
    const closed = await milestone({ closedAt: now });
    const open = await milestone();
    for (const m of [closed, open]) {
      await prisma().submission.create({ data: { milestoneId: m.id, title: "First", link: "https://example.com/1", submittedBy: f.users.sA.id, submittedAt: now } });
    }
    const auth = `Bearer ${await signIn(f.users.sA.id)}`;
    const toClosed = await request(app).post(`/api/milestones/${closed.id}/submissions`).set("Authorization", auth).send(work);
    expect(toClosed.status).toBe(409);
    expect(toClosed.body.error.code).toBe("MILESTONE_CLOSED");
    const toOpen = await request(app).post(`/api/milestones/${open.id}/submissions`).set("Authorization", auth).send(work);
    expect(toOpen.status).toBe(409);
    expect(toOpen.body.error.code).toBe("ALREADY_SUBMITTED");
    expect(await prisma().submission.count()).toBe(2);
  });

  it("TEST-08.10i (a) validates a late window against a due date extended by a concurrent transaction (BR-12)", async () => {
    const m = await milestone();
    const holder = await holdLock(m.id, { dueAt: X });
    const result = await outcome(updateMilestone(m.id, { lateUntil: new Date(D.getTime() + DAY).toISOString() }, now));
    await holder.committed;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ status: 400, fields: { lateUntil: "The late window must end after the due date." } });
    const final = await row(m.id);
    expect(final).toMatchObject({ dueAt: X, lateUntil: null });
  });

  it("TEST-08.10i (b) never moves a deadline backwards when two extensions race (BR-13)", async () => {
    const m = await milestone();
    const holder = await holdLock(m.id, { dueAt: X });
    const result = await outcome(updateMilestone(m.id, { dueAt: new Date(D.getTime() + DAY).toISOString() }, now));
    await holder.committed;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ status: 400, fields: { dueAt: "The new due date must be later than the current one." } });
    const final = await row(m.id);
    expect(final.dueAt).toEqual(X);
    expect(final.dueAt.getTime()).toBeGreaterThanOrEqual(D.getTime());
  });

  it("TEST-08.10i (c) rejects a submission that starts while a close holds the milestone (BR-11)", async () => {
    const m = await milestone();
    const holder = await holdLock(m.id, { closedAt: now, closedBy: f.users.pA.id });
    const result = await outcome(createSubmission(m.id, work, f.users.sA.id, now));
    await holder.committed;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ status: 409, code: "MILESTONE_CLOSED" });
    expect(await prisma().submission.count({ where: { milestoneId: m.id } })).toBe(0);
    expect((await row(m.id)).closedAt).toEqual(now);
  });

  it("TEST-08.10i (d) closes exactly once when two closes race", async () => {
    const m = await milestone();
    const results = await Promise.all([outcome(closeMilestone(m.id, f.users.pA.id, now)), outcome(closeMilestone(m.id, f.users.pA2.id, now))]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const failed = results.find((r) => !r.ok);
    expect(failed && !failed.ok && failed.error).toMatchObject({ status: 409, code: "MILESTONE_CLOSED" });
  });
});
