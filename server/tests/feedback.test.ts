import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { disconnectPrisma, prisma } from "../src/prisma.js";
import { expectForbidden, expectHidden } from "./support/authz.js";
import { cleanDatabase, createTeamsFixture, signIn } from "./support/teams.js";
import { createUser } from "./support/users.js";

// F-06 contract §4. The clock is fixed through createApp({ now }) and moved per test.
let clock = new Date("2026-11-09T03:00:00.000Z");
const app = createApp({ clientDistDir: null, now: () => clock });
const FEEDBACK_KEYS = ["id", "submissionId", "version", "text", "createdAt", "author"].sort();

type Fixture = Awaited<ReturnType<typeof createTeamsFixture>>;
type Name = keyof Fixture["users"] | "sA2";
let f: Fixture;
let sA2: Awaited<ReturnType<typeof createUser>>;
let sub: { id: number };
let subB: { id: number };
const tokens = new Map<number, string>();

const user = (name: Name) => (name === "sA2" ? sA2 : f.users[name]);
async function auth(name: Name) {
  const { id } = user(name);
  if (!tokens.has(id)) tokens.set(id, await signIn(id));
  return `Bearer ${tokens.get(id)}`;
}
async function post(name: Name, body: object = { text: "Good start." }, submissionId: number | string = sub.id) {
  return request(app).post(`/api/submissions/${submissionId}/feedback`).set("Authorization", await auth(name)).send(body);
}
async function list(name: Name, submissionId: number | string = sub.id) {
  return request(app).get(`/api/submissions/${submissionId}/feedback`).set("Authorization", await auth(name));
}
async function submission(teamId: number, supervisorId: number, studentId: number) {
  const milestone = await prisma().milestone.create({
    data: { teamId, title: "Milestone", dueAt: new Date("2026-11-08T16:59:59.000Z"), createdBy: supervisorId },
  });
  return prisma().submission.create({
    data: { milestoneId: milestone.id, title: "Work", link: "https://a.b", submittedBy: studentId, submittedAt: new Date("2026-11-08T10:00:00.000Z") },
  });
}
const rows = () => prisma().feedback.count();

beforeEach(async () => {
  await cleanDatabase();
  tokens.clear();
  clock = new Date("2026-11-09T03:00:00.000Z");
  f = await createTeamsFixture();
  sA2 = await createUser("STUDENT");
  await prisma().teamMember.create({ data: { studentId: sA2.id, teamId: f.teamA.id } });
  sub = await submission(f.teamA.id, f.users.pA.id, f.users.sA.id);
  subB = await submission(f.teamB.id, f.users.pB.id, f.users.sB.id);
});
afterAll(async () => {
  try {
    await cleanDatabase();
  } finally {
    await disconnectPrisma();
  }
});

describe("F-06 feedback on a submission (API + DB)", () => {
  it("TEST-06.1 stores feedback from assigned supervisors with server-set author, time and submission", async () => {
    for (const name of ["pA", "pA2"] as const) {
      const res = await post(name, {
        text: "  Good start.  ", supervisorId: f.users.pB.id, createdAt: "2000-01-01T00:00:00Z", submissionId: subB.id,
      });
      expect(res.status).toBe(201);
      expect(Object.keys(res.body.feedback).sort()).toEqual(FEEDBACK_KEYS);
      expect(res.body.feedback).toMatchObject({
        submissionId: sub.id, version: 1, text: "Good start.", createdAt: clock.toISOString(),
        author: { id: user(name).id, name: user(name).name },
      });
      expect(Object.keys(res.body.feedback.author).sort()).toEqual(["id", "name"]);
      const row = await prisma().feedback.findUniqueOrThrow({ where: { id: res.body.feedback.id } });
      expect(row).toMatchObject({ submissionId: sub.id, supervisorId: user(name).id, createdAt: clock, text: "Good start." });
    }
    expect(await prisma().feedback.count({ where: { submissionId: subB.id } })).toBe(0);
  });

  it.each([{}, { text: "   " }, { text: "x".repeat(2001) }, { text: 5 }])(
    "TEST-06.2b rejects %j with 400 fields.text and stores nothing",
    async (body) => {
      const res = await post("pA", body);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", fields: { text: "Enter feedback (1–2000 characters)." } });
      expect(Object.keys(res.body.error.fields)).toEqual(["text"]);
      expect(await rows()).toBe(0);
    },
  );

  it("TEST-06.3 shows every entry, oldest first, with version and author to members and assigned supervisors", async () => {
    clock = new Date("2026-11-09T05:00:00.000Z");
    const later = await post("pA2", { text: "Second" });
    clock = new Date("2026-11-09T04:00:00.000Z");
    const earlier = await post("pA", { text: "First" });
    for (const name of ["sA", "sA2", "pA", "pA2"] as const) {
      const res = await list(name);
      expect(res.status).toBe(200);
      expect(res.body.feedback).toEqual([earlier.body.feedback, later.body.feedback]);
      expect(res.body.feedback.map((x: { version: number }) => x.version)).toEqual([1, 1]);
    }
    expect((await list("sA", subB.id)).status).toBe(404);
  });

  it("TEST-06.3 returns an empty list before any feedback", async () => {
    const res = await list("sA");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ feedback: [] });
  });

  it("TEST-06.4a forbids students from recording feedback, even on their own team", async () => {
    expectForbidden(await post("sA"));
    expectForbidden(await post("sB"));
    expect(await rows()).toBe(0);
  });

  it("TEST-06.4b hides feedback from outsiders exactly like a missing submission", async () => {
    expect((await post("pA")).status).toBe(201);
    for (const name of ["sB", "s0", "pB"] as const) expectHidden(await list(name));
    expectHidden(await post("pB"));
    for (const id of ["999999", "abc", "0"]) {
      expectHidden(await list("sA", id));
      expectHidden(await post("pA", { text: "x" }, id));
    }
    expect(await rows()).toBe(1);
  });

  it("TEST-06.4c checks role and ownership before parsing the body", async () => {
    const raw = async (name: Name) => request(app).post(`/api/submissions/${sub.id}/feedback`)
      .set("Authorization", await auth(name)).set("Content-Type", "application/json").send('{"text":');
    expectForbidden(await raw("sA"));
    expectHidden(await raw("pB"));
    const bad = await raw("pA");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("BAD_REQUEST");
    expect(await rows()).toBe(0);
  });
});
