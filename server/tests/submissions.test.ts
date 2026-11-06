import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { disconnectPrisma, prisma } from "../src/prisma.js";
import { expectForbidden, expectHidden } from "./support/authz.js";
import { cleanDatabase, createTeamsFixture, signIn } from "./support/teams.js";
import { createUser } from "./support/users.js";

// F-05 contract §4: the clock is fixed through createApp({ now }) and moved per test.
const DUE = new Date("2026-11-08T16:59:59.000Z");
const at = (ms: number) => new Date(DUE.getTime() + ms);
const HOUR = 60 * 60 * 1000;
let clock = at(-HOUR);
const app = createApp({ clientDistDir: null, now: () => clock });

const valid = { title: "Week 1 prototype", description: "Login and team view", link: "https://github.com/org/repo" };
const SUBMISSION_KEYS = ["id", "milestoneId", "version", "title", "description", "link", "submittedAt", "submittedBy"].sort();
const MILESTONE_KEYS = ["id", "teamId", "title", "description", "dueAt", "createdBy", "createdAt", "window", "teamStatus"].sort();

type Fixture = Awaited<ReturnType<typeof createTeamsFixture>>;
let f: Fixture;
let sA2: Awaited<ReturnType<typeof createUser>>;
let mA: { id: number };
let mB: { id: number };
const tokens = new Map<number, string>();

async function auth(userId: number) {
  if (!tokens.has(userId)) tokens.set(userId, await signIn(userId));
  return `Bearer ${tokens.get(userId)}`;
}
function user(name: keyof Fixture["users"] | "sA2") {
  return name === "sA2" ? sA2 : f.users[name];
}
async function milestone(teamId: number, dueAt = DUE, createdBy = f.users.pA.id) {
  return prisma().milestone.create({ data: { teamId, title: `Milestone ${Math.random()}`, dueAt, createdBy } });
}
async function submit(name: Parameters<typeof user>[0], milestoneId = mA.id, body: object = valid) {
  return request(app).post(`/api/milestones/${milestoneId}/submissions`).set("Authorization", await auth(user(name).id)).send(body);
}
async function read(name: Parameters<typeof user>[0], milestoneId: number | string = mA.id) {
  return request(app).get(`/api/milestones/${milestoneId}/submission`).set("Authorization", await auth(user(name).id));
}
const rows = (milestoneId = mA.id) => prisma().submission.count({ where: { milestoneId } });

beforeEach(async () => {
  await cleanDatabase();
  tokens.clear();
  clock = at(-HOUR);
  f = await createTeamsFixture();
  sA2 = await createUser("STUDENT");
  await prisma().teamMember.create({ data: { studentId: sA2.id, teamId: f.teamA.id } });
  mA = await milestone(f.teamA.id);
  mB = await milestone(f.teamB.id, DUE, f.users.pB.id);
});
afterAll(async () => {
  try {
    await cleanDatabase();
  } finally {
    await disconnectPrisma();
  }
});

describe("F-05 submit milestone work (API + DB)", () => {
  it("TEST-05.1 stores version 1 with the submitter and server time, and GET returns it", async () => {
    const res = await submit("sA");
    expect(res.status).toBe(201);
    expect(Object.keys(res.body.submission).sort()).toEqual(SUBMISSION_KEYS);
    expect(res.body.submission).toMatchObject({
      milestoneId: mA.id, version: 1, ...valid, submittedAt: clock.toISOString(),
      submittedBy: { id: f.users.sA.id, name: f.users.sA.name },
    });
    expect(Object.keys(res.body.submission.submittedBy).sort()).toEqual(["id", "name"]);

    const row = await prisma().submission.findFirstOrThrow({ where: { milestoneId: mA.id } });
    expect(row).toMatchObject({ version: 1, submittedBy: f.users.sA.id, submittedAt: clock });

    const got = await read("sA");
    expect(got.status).toBe(200);
    expect(got.body.submission).toEqual(res.body.submission);
    expect(got.body.milestone).toMatchObject({ id: mA.id, window: "OPEN", teamStatus: "SUBMITTED" });
  });

  it("TEST-05.1b ignores client-sent version, submitter and time; no private fields", async () => {
    const res = await submit("sA", mA.id, {
      ...valid, submittedAt: "2000-01-01T00:00:00Z", version: 9, submittedBy: f.users.pB.id, teamId: f.teamB.id,
    });
    expect(res.status).toBe(201);
    const row = await prisma().submission.findFirstOrThrow({ where: { milestoneId: mA.id } });
    expect(row).toMatchObject({ version: 1, submittedBy: f.users.sA.id, submittedAt: clock });
    expect(JSON.stringify(res.body)).not.toMatch(/password|email/i);
  });

  it.each([
    [{}, ["link", "title"]],
    [{ ...valid, title: "   " }, ["title"]],
    [{ ...valid, title: "x".repeat(121) }, ["title"]],
    [{ ...valid, description: "x".repeat(2001) }, ["description"]],
    [{ ...valid, link: "example.com" }, ["link"]],
    [{ ...valid, link: "/work" }, ["link"]],
    [{ ...valid, link: "ftp://a.b" }, ["link"]],
    [{ ...valid, link: "javascript:alert(1)" }, ["link"]],
    [{ ...valid, link: "https://" }, ["link"]],
    [{ ...valid, link: `https://a.b/${"x".repeat(2037)}` }, ["link"]],
    [{ title: 5, description: [], link: {} }, ["description", "link", "title"]],
  ])("TEST-05.2b rejects %j with 400 fields and stores nothing", async (body, fields) => {
    const res = await submit("sA", mA.id, body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.error.fields).sort()).toEqual(fields);
    expect(await rows()).toBe(0);
  });

  it("TEST-05.3b accepts at due − 1 s and at due, rejects at due + 1 s using the server clock", async () => {
    const [m1, m2, m3] = [await milestone(f.teamA.id), await milestone(f.teamA.id), await milestone(f.teamA.id)];
    clock = at(-1000);
    expect((await submit("sA", m1.id)).status).toBe(201);
    clock = at(0);
    expect((await submit("sA", m2.id)).status).toBe(201);
    clock = at(1000);
    const late = await submit("sA", m3.id, { ...valid, submittedAt: DUE.toISOString() });
    expect(late.status).toBe(409);
    expect(late.body).toEqual({ error: { code: "DEADLINE_PASSED", message: "The deadline for this milestone has passed." } });
    expect(await rows(m3.id)).toBe(0);
  });

  it("TEST-05.4a rejects a second submission from any member, before and after the deadline", async () => {
    expect((await submit("sA")).status).toBe(201);
    const ALREADY = { error: { code: "ALREADY_SUBMITTED", message: "Your team has already submitted work for this milestone." } };
    for (const name of ["sA2", "sA"] as const) {
      const res = await submit(name);
      expect(res.status).toBe(409);
      expect(res.body).toEqual(ALREADY);
    }
    clock = at(1000);
    expect((await submit("sA2")).body).toEqual(ALREADY);
    expect(await rows()).toBe(1);
  });

  it("TEST-05.4b lets exactly one of two simultaneous submissions succeed", async () => {
    const results = await Promise.all([submit("sA"), submit("sA2")]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe("ALREADY_SUBMITTED");
    expect(await rows()).toBe(1);
  });

  it("TEST-05.5a shows the same submission to every member and assigned supervisor", async () => {
    const viewers = ["sA", "sA2", "pA", "pA2"] as const;
    for (const name of viewers) {
      const res = await read(name);
      expect(res.status).toBe(200);
      expect(res.body.submission).toBeNull();
      expect(res.body.milestone.teamStatus).toBe("NOT_SUBMITTED");
      expect(Object.keys(res.body.milestone).sort()).toEqual(MILESTONE_KEYS);
    }
    const created = await submit("sA");
    for (const name of viewers) {
      const res = await read(name);
      expect(res.body.submission).toEqual(created.body.submission);
      expect(res.body.submission.submittedBy).toEqual({ id: f.users.sA.id, name: f.users.sA.name });
    }
  });

  it("TEST-05.5b hides the milestone from other teams, students without a team and unassigned supervisors", async () => {
    await submit("sA");
    for (const name of ["sB", "s0", "pB"] as const) expectHidden(await read(name));
    expectHidden(await read("sB", 999999));
    expectHidden(await read("sA", "abc"));
    for (const name of ["sB", "s0"] as const) expectHidden(await submit(name));
    expectHidden(await submit("sA", "abc" as unknown as number));
    expectHidden(await submit("sA", 999999));
    expect(await rows()).toBe(1);
  });

  it("TEST-05.8b reports Overdue without a submission and Submitted after the deadline", async () => {
    clock = at(1000);
    const overdue = await read("sA");
    expect(overdue.body.milestone).toMatchObject({ window: "CLOSED", teamStatus: "OVERDUE" });
    expect(overdue.body.submission).toBeNull();

    const later = await milestone(f.teamA.id, at(HOUR));
    expect((await submit("sA", later.id)).status).toBe(201);
    clock = at(2 * HOUR);
    expect((await read("sA", later.id)).body.milestone).toMatchObject({ window: "CLOSED", teamStatus: "SUBMITTED" });
  });

  it("TEST-05.8c makes F-04's list and detail report Submitted without changing their shape", async () => {
    const mA2 = await milestone(f.teamA.id);
    expect((await submit("sA")).status).toBe(201);
    clock = at(1000);
    const list = await request(app).get(`/api/teams/${f.teamA.id}/milestones`).set("Authorization", await auth(f.users.sA.id));
    expect(list.status).toBe(200);
    const status = Object.fromEntries(list.body.milestones.map((m: { id: number; teamStatus: string }) => [m.id, m.teamStatus]));
    expect(status).toEqual({ [mA.id]: "SUBMITTED", [mA2.id]: "OVERDUE" });
    for (const m of list.body.milestones) expect(Object.keys(m).sort()).toEqual(MILESTONE_KEYS);

    const detail = await request(app).get(`/api/milestones/${mA.id}`).set("Authorization", await auth(f.users.pA.id));
    expect(detail.body.milestone.teamStatus).toBe("SUBMITTED");
    expect(Object.keys(detail.body.milestone).sort()).toEqual(MILESTONE_KEYS);
  });

  it("TEST-05.9a forbids supervisors from submitting, even for an assigned team", async () => {
    expectForbidden(await submit("pA"));
    expectForbidden(await submit("pB"));
    expect(await rows()).toBe(0);
  });

  it("TEST-05.9b checks 403 and 404 before parsing or validating the body", async () => {
    const raw = async (name: Parameters<typeof user>[0]) => request(app)
      .post(`/api/milestones/${mA.id}/submissions`).set("Authorization", await auth(user(name).id))
      .set("Content-Type", "application/json").send('{"title":');
    expectForbidden(await raw("pA"));
    expectHidden(await raw("sB"));
    expectHidden(await submit("sB", mA.id, { title: "" }));
    const bad = await raw("sA");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("BAD_REQUEST");
    expect(await rows()).toBe(0);
    expect(await rows(mB.id)).toBe(0);
  });
});
