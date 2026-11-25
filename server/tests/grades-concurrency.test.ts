import { setTimeout as delay } from "node:timers/promises";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { releaseGrade, saveGrade } from "../src/grades/service.js";
import { disconnectPrisma, prisma } from "../src/prisma.js";
import { cleanDatabase, createTeamsFixture } from "./support/teams.js";

const draftTime = new Date("2026-11-25T10:00:00.000Z");
const heldTime = new Date("2026-11-25T11:00:00.000Z");
const competitorTime = new Date("2026-11-25T12:00:00.000Z");
let fixture: Awaited<ReturnType<typeof createTeamsFixture>>;

beforeEach(async () => {
  await cleanDatabase();
  fixture = await createTeamsFixture();
});
afterAll(async () => { try { await cleanDatabase(); } finally { await disconnectPrisma(); } });

async function seedDraft() {
  const { users, teamA } = fixture;
  const m = await prisma().milestone.create({ data: {
    teamId: teamA.id, title: "Grade lock test", createdBy: users.pA.id, dueAt: draftTime,
  } });
  await prisma().grade.create({ data: { milestoneId: m.id, draftScore: 70, updatedBy: users.pA.id, updatedAt: draftTime } });
  await Promise.all(Array.from({ length: 4 }, () => prisma().$executeRaw`SELECT pg_sleep(0.05)`));
  return m.id;
}

const asOutcome = <T,>(work: Promise<T>) => work.then(
  (value) => ({ ok: true, value } as const),
  (error: unknown) => ({ ok: false, error } as const),
);

async function withHeldMilestone<T>(id: number, hold: (tx: Prisma.TransactionClient) => Promise<unknown>, compete: () => Promise<T>): Promise<T> {
  let markReady!: (pid: number) => void;
  let release!: () => void;
  const ready = new Promise<number>((resolve) => { markReady = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const holder = asOutcome(prisma().$transaction(async (tx) => {
    const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    await tx.$queryRaw`SELECT id FROM milestones WHERE id = ${id} FOR UPDATE`;
    await hold(tx);
    markReady(pid);
    await gate;
  }, { timeout: 15_000 }));

  let contender: ReturnType<typeof asOutcome<T>> | undefined;
  let contenderFinished = false;
  try {
    const pid = await Promise.race([ready, holder.then((result) => {
      if (!result.ok) throw result.error;
      throw new Error("The holder finished before acquiring its milestone lock");
    })]);
    contender = asOutcome(compete()).then((result) => { contenderFinished = true; return result; });
    const deadline = performance.now() + 4_000;
    let observed = false;
    while (performance.now() < deadline) {
      if (contenderFinished) {
        const result = await contender;
        throw new Error("The grade write completed without waiting on the milestone lock", { cause: result.ok ? undefined : result.error });
      }
      const blockers = await prisma().$queryRaw<{ query: string }[]>`
        SELECT query FROM pg_stat_activity
        WHERE datname = current_database() AND ${pid}::int = ANY(pg_blocking_pids(pg_stat_activity.pid))
      `;
      if (blockers.length > 0) {
        // A Grade-row UPDATE can block even when the required milestone lock is absent.
        // Require PostgreSQL to identify the waiting statement as the milestone lock itself.
        expect(blockers.map(({ query }) => query)).toEqual([expect.stringMatching(/\bFROM\s+"?milestones"?\s+WHERE\b[\s\S]*\bFOR UPDATE\b/i)]);
        observed = true;
        break;
      }
      await delay(25);
    }
    if (!observed) throw new Error("PostgreSQL did not observe a competing milestone lock");
  } finally {
    release();
    await Promise.all([holder, contender]);
  }

  const committed = await holder;
  if (!committed.ok) throw committed.error;
  const result = await contender!;
  if (!result.ok) throw result.error;
  return result.value;
}

describe("F-10 grade lock", () => {
  it("TEST-10.3bi (a) a release waits on the milestone before reading the newly saved draft", async () => {
    const id = await seedDraft();
    const draftAuthor = fixture.users.pA.id;
    const releaser = fixture.users.pA2.id;
    await withHeldMilestone(id, (tx) => tx.grade.update({
      where: { milestoneId: id }, data: { draftScore: 82, updatedBy: draftAuthor, updatedAt: heldTime },
    }), () => releaseGrade(id, releaser, undefined, competitorTime));
    expect(await prisma().grade.findMany()).toEqual([{
      milestoneId: id, draftScore: 82, updatedBy: draftAuthor, updatedAt: heldTime,
      releasedScore: 82, releasedBy: releaser, releasedAt: competitorTime,
    }]);
  }, 20_000);

  it("TEST-10.3bi (b) a save waits on the milestone and retains the prior release snapshot", async () => {
    const id = await seedDraft();
    const releaser = fixture.users.pA.id;
    const draftAuthor = fixture.users.pA2.id;
    await withHeldMilestone(id, (tx) => tx.grade.update({
      where: { milestoneId: id }, data: { releasedScore: 70, releasedBy: releaser, releasedAt: heldTime },
    }), () => saveGrade(id, draftAuthor, 82, competitorTime));
    expect(await prisma().grade.findMany()).toEqual([{
      milestoneId: id, draftScore: 82, updatedBy: draftAuthor, updatedAt: competitorTime,
      releasedScore: 70, releasedBy: releaser, releasedAt: heldTime,
    }]);
  }, 20_000);
});
