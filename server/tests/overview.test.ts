import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { disconnectPrisma, prisma } from "../src/prisma.js";
import { expectForbidden, expectHidden, UNAUTHENTICATED } from "./support/authz.js";
import { cleanDatabase, createTeamsFixture, signIn } from "./support/teams.js";
import { createUser } from "./support/users.js";

// F-12 contract v0.2 §1–§4: TEST-12.1i, 12.2i, 12.3i. Real API and PostgreSQL with a fixed server clock.
const NOW = new Date("2026-11-28T12:00:00Z");
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000);
const app = createApp({ clientDistDir: null, now: () => NOW });

let f: Awaited<ReturnType<typeof createTeamsFixture>>;
let teamA2: { id: number; name: string };
const tokens = new Map<number, string>();
async function auth(userId: number) {
  if (!tokens.has(userId)) tokens.set(userId, await signIn(userId));
  return `Bearer ${tokens.get(userId)}`;
}
const overview = async (userId: number | null, query = "") => {
  const req = request(app).get(`/api/overview${query}`);
  return userId === null ? req : req.set("Authorization", await auth(userId));
};
async function milestone(teamId: number, title: string, dueAt: Date, lateUntil: Date | null = null) {
  return prisma().milestone.create({ data: { teamId, title, dueAt, lateUntil, createdBy: f.users.pA.id, createdAt: hours(-200) } });
}
async function version(milestoneId: number, v: number, at: Date, late = false) {
  return prisma().submission.create({ data: {
    milestoneId, version: v, late, title: `Work v${v}`, link: `https://example.com/v${v}`, submittedBy: f.users.sA.id, submittedAt: at,
  } });
}
async function feedback(submissionId: number) {
  return prisma().feedback.create({ data: { submissionId, supervisorId: f.users.pA.id, text: "Looks good", createdAt: hours(-1) } });
}

// pA supervises Team A and Team A2, not Team B (AC-12.1). Every submission and feedback state appears.
let m: Record<string, { id: number }>;
async function seedStates() {
  const A = f.teamA.id, A2 = teamA2.id;
  const late = await milestone(A, "A late", hours(-6), hours(6));
  await version(late.id, 1, hours(-1), true);                                       // LATE, AWAITING
  const received = await milestone(A, "A received", hours(-24));
  await feedback((await version(received.id, 1, hours(-30))).id);                   // SUBMITTED, RECEIVED
  const awaiting = await milestone(A, "A awaiting", hours(24));
  await version(awaiting.id, 1, hours(-2));                                         // SUBMITTED, AWAITING
  const missing = await milestone(A, "A missing", hours(-48));                      // MISSING, NONE
  const notDue = await milestone(A, "A not due", hours(48));                        // NOT_DUE, NONE
  const a2Missing = await milestone(A2, "A2 missing", hours(-12));                  // MISSING, NONE
  const a2Late = await milestone(A2, "A2 late received", hours(-3), hours(3));
  await feedback((await version(a2Late.id, 1, hours(-1), true)).id);                // LATE, RECEIVED
  await milestone(f.teamB.id, "B secret milestone", hours(-1));                     // never visible to pA
  m = { late, received, awaiting, missing, notDue, a2Missing, a2Late };
}
const ids = (res: { body: { rows: { milestoneId: number }[] } }) => res.body.rows.map((r) => r.milestoneId);

beforeEach(async () => {
  await cleanDatabase();
  tokens.clear();
  f = await createTeamsFixture();
  teamA2 = await prisma().team.create({ data: { courseId: f.course.id, name: "Team A2" } });
  await prisma().supervisorTeam.create({ data: { supervisorId: f.users.pA.id, teamId: teamA2.id } });
});
afterAll(async () => {
  await cleanDatabase();
  await disconnectPrisma();
});

describe("F-12 supervisor overview", () => {
  it("TEST-12.1i returns only pA's teams, ordered by team name, due date and id, with every state", async () => {
    await seedStates();
    const res = await overview(f.users.pA.id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 50, total: 7, filters: { team: null, state: [] } });
    expect(ids(res)).toEqual([m.missing.id, m.received.id, m.late.id, m.awaiting.id, m.notDue.id, m.a2Missing.id, m.a2Late.id]);
    expect(JSON.stringify(res.body)).not.toContain("B secret milestone");
    expect(JSON.stringify(res.body)).not.toContain("Team B");

    expect(res.body.rows[2]).toEqual({
      teamId: f.teamA.id, teamName: "Team A", milestoneId: m.late.id, title: "A late", dueAt: hours(-6).toISOString(),
      window: "LATE", submissionState: "LATE", feedbackState: "AWAITING", latestVersion: 1,
    });
    const pick = (r: { submissionState: string; feedbackState: string }) => [r.submissionState, r.feedbackState];
    expect(res.body.rows.map(pick)).toEqual([
      ["MISSING", "NONE"], ["SUBMITTED", "RECEIVED"], ["LATE", "AWAITING"], ["SUBMITTED", "AWAITING"],
      ["NOT_DUE", "NONE"], ["MISSING", "NONE"], ["LATE", "RECEIVED"],
    ]);

    // DEC-13: the same states as the F-11 board and the F-04 milestone list for each team, row by row.
    const map: Record<string, string> = { LATE: "LATE", SUBMITTED: "SUBMITTED", OVERDUE: "MISSING", NOT_SUBMITTED: "NOT_DUE" };
    for (const team of [f.teamA, teamA2]) {
      const board = await request(app).get(`/api/teams/${team.id}/progress`).set("Authorization", await auth(f.users.pA.id));
      const list = await request(app).get(`/api/teams/${team.id}/milestones`).set("Authorization", await auth(f.users.pA.id));
      for (const row of res.body.rows.filter((r: { teamId: number }) => r.teamId === team.id)) {
        const b = board.body.rows.find((x: { milestoneId: number }) => x.milestoneId === row.milestoneId);
        const l = list.body.milestones.find((x: { id: number }) => x.id === row.milestoneId);
        expect(row.submissionState).toBe(map[b.teamStatus]);
        expect(row.submissionState).toBe(map[l.teamStatus]);
        expect(row.feedbackState).toBe(b.feedbackStatus);
        expect(row.window).toBe(b.window);
        expect(row.latestVersion).toBe(b.latest?.version ?? null);
      }
    }
  });

  it("TEST-12.1i gives pB only Team B and a Supervisor with no teams an empty 200", async () => {
    await seedStates();
    const b = await overview(f.users.pB.id);
    expect(b.status).toBe(200);
    expect(b.body.rows.map((r: { title: string }) => r.title)).toEqual(["B secret milestone"]);
    const lonely = await createUser("SUPERVISOR");
    const none = await overview(lonely.id);
    expect(none.status).toBe(200);
    expect(none.body).toEqual({ rows: [], page: 1, pageSize: 50, total: 0, filters: { team: null, state: [] } });
  });

  it("TEST-12.2i filters by team, by state (repeated values are OR) and by both, with matching totals", async () => {
    await seedStates();
    const byTeam = await overview(f.users.pA.id, `?team=${teamA2.id}`);
    expect(ids(byTeam)).toEqual([m.a2Missing.id, m.a2Late.id]);
    expect(byTeam.body).toMatchObject({ total: 2, filters: { team: teamA2.id, state: [] } });

    const missing = await overview(f.users.pA.id, "?state=MISSING");
    expect(ids(missing)).toEqual([m.missing.id, m.a2Missing.id]);
    expect(missing.body).toMatchObject({ total: 2, filters: { team: null, state: ["MISSING"] } });

    // LATE (submission state) OR AWAITING (feedback state).
    const lateOrAwaiting = await overview(f.users.pA.id, "?state=AWAITING&state=LATE");
    expect(ids(lateOrAwaiting)).toEqual([m.late.id, m.awaiting.id, m.a2Late.id]);
    expect(lateOrAwaiting.body).toMatchObject({ total: 3, filters: { team: null, state: ["LATE", "AWAITING"] } });

    const both = await overview(f.users.pA.id, `?team=${f.teamA.id}&state=SUBMITTED`);
    expect(ids(both)).toEqual([m.received.id, m.awaiting.id]);
    expect(both.body).toMatchObject({ total: 2, filters: { team: f.teamA.id, state: ["SUBMITTED"] } });

    const repeated = await overview(f.users.pA.id, "?state=MISSING&state=MISSING");
    expect(repeated.body).toMatchObject({ total: 2, filters: { state: ["MISSING"] } });
  });

  it("TEST-12.2i pages a filtered result: 50 rows, then the rest, with the filtered total", async () => {
    await prisma().milestone.createMany({ data: Array.from({ length: 52 }, (_, i) => ({
      teamId: teamA2.id, title: `Future ${String(i).padStart(2, "0")}`, dueAt: hours(100 + i), createdBy: f.users.pA.id, createdAt: hours(-200),
    })) });
    await milestone(f.teamA.id, "A missing", hours(-48));
    const page1 = await overview(f.users.pA.id, "?state=NOT_DUE");
    expect(page1.body.rows).toHaveLength(50);
    expect(page1.body).toMatchObject({ page: 1, total: 52 });
    expect(page1.body.rows[0].title).toBe("Future 00");
    const page2 = await overview(f.users.pA.id, "?state=NOT_DUE&page=2");
    expect(page2.body.rows.map((r: { title: string }) => r.title)).toEqual(["Future 50", "Future 51"]);
    expect(page2.body).toMatchObject({ page: 2, total: 52 });
    const page3 = await overview(f.users.pA.id, "?state=NOT_DUE&page=3");
    expect(page3.body).toMatchObject({ rows: [], page: 3, total: 52 });
  });

  it("TEST-12.3i answers 401, 403, the fixed 404 for another or unknown team, and 400 for bad filters, without B data", async () => {
    await seedStates();
    const anonymous = await overview(null);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual(UNAUTHENTICATED);
    expectForbidden(await overview(f.users.sA.id));
    expectForbidden(await overview(f.users.sA.id, "?state=BOGUS")); // the role check comes before validation

    for (const team of [String(f.teamB.id), "999999", "abc", "0", `${f.teamA.id}&team=${teamA2.id}`]) {
      const res = await overview(f.users.pA.id, `?team=${team}`);
      expectHidden(res);
      expect(JSON.stringify(res.body)).not.toContain("B secret milestone");
    }
    const lonely = await createUser("SUPERVISOR");
    expectHidden(await overview(lonely.id, `?team=${f.teamA.id}`));

    for (const state of ["BOGUS", "late", "", "NONE", "RECEIVED"]) {
      const res = await overview(f.users.pA.id, `?state=${state}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", fields: { state: expect.any(String) } });
    }
    for (const page of ["0", "abc", "-1"]) {
      const res = await overview(f.users.pA.id, `?page=${page}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", fields: { page: expect.any(String) } });
    }
    // Validation (400) runs before the team scope (404), so a bad state never confirms a team.
    const badStateOtherTeam = await overview(f.users.pA.id, `?team=${f.teamB.id}&state=BOGUS`);
    expect(badStateOtherTeam.status).toBe(400);
    expect(JSON.stringify(badStateOtherTeam.body)).not.toContain("Team B");
  });
});
