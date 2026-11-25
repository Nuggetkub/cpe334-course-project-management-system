import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { disconnectPrisma, prisma } from "../src/prisma.js";
import { createSubmission } from "../src/submissions/service.js";
import { expectForbidden, expectHidden } from "./support/authz.js";
import { cleanDatabase, createTeamsFixture, signIn } from "./support/teams.js";
import { createUser } from "./support/users.js";

const now = new Date("2026-11-25T10:00:00Z");
const app = request(createApp({ clientDistDir: null, now: () => now }));
const input = { title: "Work", description: "Example", link: "https://example.test/work" };
let fixture: Awaited<ReturnType<typeof createTeamsFixture>>;

const teamPath = (id: number) => `/api/teams/${id}`;
const membersPath = (id: number) => `${teamPath(id)}/members`;
const auth = async (userId: number) => `Bearer ${await signIn(userId)}`;
const summary = ({ id, name }: { id: number; name: string }) => ({ id, name });
const errorCode = (res: { status: number; body: { error?: { code?: string } } }, status: number, code: string) => {
  expect(res.status).toBe(status);
  expect(res.body.error?.code).toBe(code);
};

async function milestone() {
  return prisma().milestone.create({ data: {
    teamId: fixture.teamA.id, createdBy: fixture.users.pA.id, title: "Open milestone",
    dueAt: new Date("2026-11-27T10:00:00Z"),
  } });
}

beforeEach(async () => {
  await cleanDatabase();
  fixture = await createTeamsFixture();
});
afterAll(async () => {
  try { await cleanDatabase(); } finally { await disconnectPrisma(); }
});

describe("F-07 supervisor team management", () => {
  it("TEST-07.1i creates a team and only the calling supervisor's assignment", async () => {
    const { course, users } = fixture;
    const creator = await createUser("SUPERVISOR");
    const token = await auth(creator.id);
    const result = await app.post("/api/teams").set("Authorization", token)
      .send({ name: "  New Team  ", courseId: -1, supervisorId: users.pB.id });
    expect(result.status).toBe(201);
    expect(result.body).toEqual({ team: { id: expect.any(Number), name: "New Team" } });
    expect(await prisma().team.findUnique({ where: { id: result.body.team.id }, include: { supervisors: true } }))
      .toMatchObject({ courseId: course.id, supervisors: [{ supervisorId: creator.id }] });
    expect((await app.get("/api/teams").set("Authorization", token)).body).toEqual({ teams: [result.body.team] });

    const duplicate = await app.post("/api/teams").set("Authorization", await auth(users.pB.id))
      .send({ name: "  New Team " });
    errorCode(duplicate, 409, "TEAM_NAME_UNAVAILABLE");
    expect(duplicate.body.error.fields).toEqual({ name: expect.any(String) });
    expect(await prisma().team.count()).toBe(3);
    expect(await prisma().supervisorTeam.count()).toBe(4);
  });

  it.each(["zero", "multiple"])("TEST-07.1i rejects %s configured courses without writing", async (mode) => {
    const db = prisma();
    if (mode === "zero") {
      await db.supervisorTeam.deleteMany();
      await db.teamMember.deleteMany();
      await db.team.deleteMany();
      await db.course.deleteMany();
    } else {
      await db.course.create({ data: { code: "SECOND", name: "Second course" } });
    }
    const before = await db.team.count();
    const assignments = await db.supervisorTeam.count();
    const res = await app.post("/api/teams").set("Authorization", await auth(fixture.users.pA.id)).send({ name: "New Team" });
    errorCode(res, 409, "COURSE_UNAVAILABLE");
    expect(await db.team.count()).toBe(before);
    expect(await db.supervisorTeam.count()).toBe(assignments);
  });

  it("validates and normalizes names and student IDs at the API boundary", async () => {
    const { teamA, users } = fixture;
    const token = await auth(users.pA.id);
    const unicode = "📚".repeat(120);
    for (const name of [" A ", ` ${unicode} `]) {
      const res = await app.post("/api/teams").set("Authorization", token).send({ name });
      expect(res.status).toBe(201);
      expect(res.body.team.name).toBe(name.trim());
    }
    for (const name of [" ", `${unicode}📚`, 1, undefined]) {
      const res = await app.post("/api/teams").set("Authorization", token).send({ name, supervisorId: users.pB.id });
      errorCode(res, 400, "VALIDATION_ERROR");
      expect(res.body.error.fields).toEqual({ name: expect.any(String) });
    }
    for (const studentId of [0, 2147483648, 1.5, String(users.s0.id), undefined]) {
      const res = await app.post(membersPath(teamA.id)).set("Authorization", token).send({ studentId, name: "extra" });
      errorCode(res, 400, "VALIDATION_ERROR");
      expect(res.body.error.fields).toEqual({ studentId: expect.any(String) });
    }
  });

  it("TEST-07.2i gives a co-supervisor minimal roster and scoped, paginated candidates", async () => {
    const { teamA, teamB, users } = fixture;
    const db = prisma();
    const token = await auth(users.pA2.id);
    const roster = await app.get(teamPath(teamA.id)).set("Authorization", token);
    expect(roster.status).toBe(200);
    expect(roster.body).toEqual({ team: { ...summary(teamA), members: [summary(users.sA)] } });
    await db.user.update({ where: { id: users.s0.id }, data: { name: "Candidate Same" } });
    await db.user.createMany({ data: Array.from({ length: 25 }, (_, i) => ({
      role: "STUDENT", name: "Candidate Same", email: `candidate-${i}@example.test`, passwordHash: "unused-test-placeholder",
    })) });
    const candidates = `${teamPath(teamA.id)}/member-candidates`;
    const page1 = await app.get(candidates).query({ q: "  CANdidate " }).set("Authorization", token);
    const page2 = await app.get(candidates).query({ q: "candidate", page: 2 }).set("Authorization", token);
    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);
    const expected = await db.user.findMany({ where: { name: "Candidate Same" }, orderBy: { id: "asc" }, select: { id: true, name: true } });
    expect(page1.body).toEqual({ students: expected.slice(0, 25), page: 1, hasMore: true });
    expect(page2.body).toEqual({ students: expected.slice(25), page: 2, hasMore: false });
    const unfiltered = await app.get(candidates).set("Authorization", token);
    expect(unfiltered.body).toEqual({ students: expected.slice(0, 25), page: 1, hasMore: true });
    for (const query of ["?page=0", "?q=a&q=b", "?page=2147483648"]) {
      errorCode(await app.get(`${candidates}${query}`).set("Authorization", token), 400, "VALIDATION_ERROR");
    }

    const added = await app.post(membersPath(teamA.id)).set("Authorization", token).send({ studentId: users.s0.id, teamId: teamB.id });
    expect(added.status).toBe(201);
    expect(added.body).toEqual({ member: expected[0] });
    const studentView = await app.get("/api/teams/mine").set("Authorization", await auth(users.s0.id));
    expect(studentView.status).toBe(200);
    expect(studentView.body.team.id).toBe(teamA.id);
    const unavailable = await Promise.all([
      app.post(membersPath(teamA.id)).set("Authorization", token).send({ studentId: users.s0.id }),
      app.post(membersPath(teamB.id)).set("Authorization", await auth(users.pB.id)).send({ studentId: users.s0.id }),
      app.post(membersPath(teamA.id)).set("Authorization", token).send({ studentId: users.pA.id }),
      app.post(membersPath(teamA.id)).set("Authorization", token).send({ studentId: 2147483647 }),
    ]);
    for (const res of unavailable) {
      errorCode(res, 409, "STUDENT_UNAVAILABLE");
      expect(res.body).toEqual(unavailable[0].body);
      expect(res.body).toEqual({ error: { code: "STUDENT_UNAVAILABLE", message: expect.any(String) } });
    }
    expect(await db.teamMember.findMany({ where: { studentId: users.s0.id } })).toEqual([{ studentId: users.s0.id, teamId: teamA.id }]);
  });

  it("TEST-07.2bi creates exactly one membership for concurrent offers from different teams", async () => {
    const { teamA, teamB, users } = fixture;
    const [a, b] = await Promise.all([auth(users.pA.id), auth(users.pB.id)]);
    const result = await Promise.all([teamA, teamB].map((team, i) => app.post(membersPath(team.id))
      .set("Authorization", i === 0 ? a : b).send({ studentId: users.s0.id })));
    expect(result.map((res) => res.status).sort()).toEqual([201, 409]);
    errorCode(result.find((res) => res.status === 409)!, 409, "STUDENT_UNAVAILABLE");
    expect(await prisma().teamMember.findMany({ where: { studentId: users.s0.id } })).toEqual([
      { studentId: users.s0.id, teamId: result[0].status === 201 ? teamA.id : teamB.id },
    ]);
  });

  it("TEST-07.3i and TEST-07.4i preserve older authors and remove only the non-author", async () => {
    const { teamA, users } = fixture;
    const db = prisma();
    const token = await auth(users.pA.id);
    const teammate = await createUser();
    await db.teamMember.createMany({ data: [teammate.id, users.s0.id].map((studentId) => ({ studentId, teamId: teamA.id })) });
    const row = await milestone();
    const first = await createSubmission(row.id, input, users.sA.id, now);
    const second = await createSubmission(row.id, input, teammate.id, now);
    const feedback = await db.feedback.create({ data: { submissionId: first.id, supervisorId: users.pA.id, text: "Keep this", createdAt: now } });
    const remove = (id: number) => app.delete(`${membersPath(teamA.id)}/${id}`).set("Authorization", token);
    errorCode(await remove(users.sA.id), 409, "MEMBER_HAS_SUBMISSIONS");
    const memberToken = await auth(users.s0.id);
    const removed = await remove(users.s0.id);
    expect(removed.status).toBe(204);
    expect(removed.text).toBe("");
    expectHidden(await app.get("/api/teams/mine").set("Authorization", memberToken));
    expectHidden(await app.get(`/api/milestones/${row.id}`).set("Authorization", memberToken));
    expect(await db.teamMember.findMany({ where: { teamId: teamA.id }, orderBy: { studentId: "asc" } }))
      .toEqual([users.sA.id, teammate.id].map((studentId) => ({ studentId, teamId: teamA.id })));
    expect(await db.submission.findMany({ where: { milestoneId: row.id }, orderBy: { version: "asc" }, select: { id: true } }))
      .toEqual([{ id: first.id }, { id: second.id }]);
    expect(await db.feedback.findUnique({ where: { id: feedback.id } })).toEqual(feedback);
  });

  it.each(["submit first", "remove first", "concurrent"])("TEST-07.4bi serializes removal and submission: %s", async (order) => {
    const { teamA, users } = fixture;
    const m = await milestone();
    const token = await auth(users.pA.id);
    const submit = () => createSubmission(m.id, input, users.sA.id, now).then(
      () => ({ status: 201, code: undefined }),
      (error: unknown) => {
        if (!(error instanceof Error) || !("status" in error) || !("code" in error)) throw error;
        return { status: error.status, code: error.code };
      },
    );
    const remove = async () => {
      const res = await app.delete(`${membersPath(teamA.id)}/${users.sA.id}`).set("Authorization", token);
      return { status: res.status, code: res.body.error?.code };
    };
    let results;
    if (order === "submit first") results = [await submit(), await remove()];
    else if (order === "remove first") {
      const removed = await remove();
      results = [await submit(), removed];
    } else results = await Promise.all([submit(), remove()]);

    const submitted = order === "submit first" || (order === "concurrent" && results[0].status === 201);
    expect(results).toEqual(submitted
      ? [{ status: 201, code: undefined }, { status: 409, code: "MEMBER_HAS_SUBMISSIONS" }]
      : [{ status: 404, code: "NOT_FOUND" }, { status: 204, code: undefined }]);
    expect(await prisma().submission.count({ where: { milestoneId: m.id } })).toBe(submitted ? 1 : 0);
    expect(await prisma().teamMember.count({ where: { teamId: teamA.id, studentId: users.sA.id } })).toBe(submitted ? 1 : 0);
  });

  it("TEST-07.5i checks role and scope before input validation and preserves state", async () => {
    const { teamA, users } = fixture;
    const [student, outside, within] = await Promise.all([auth(users.sA.id), auth(users.pB.id), auth(users.pA.id)]);
    const malformed = (path: string, token: string) => app.post(path).set("Authorization", token).type("json").send("{");
    expectForbidden(await malformed("/api/teams", student));
    expectForbidden(await malformed(membersPath(teamA.id), student));
    expectForbidden(await app.get(teamPath(teamA.id)).set("Authorization", student));
    expectForbidden(await app.get(`${teamPath(teamA.id)}/member-candidates?page=0`).set("Authorization", student));
    expectForbidden(await app.delete(`${membersPath(teamA.id)}/0`).set("Authorization", student));
    expectHidden(await app.get(teamPath(teamA.id)).set("Authorization", outside));
    expectHidden(await app.get(`${teamPath(teamA.id)}/member-candidates?page=0`).set("Authorization", outside));
    expectHidden(await malformed(membersPath(teamA.id), outside));
    expectHidden(await malformed(membersPath(2147483647), within));
    expectHidden(await app.delete(`${membersPath(teamA.id)}/${users.sA.id}`).set("Authorization", outside));
    expectHidden(await app.delete(`${membersPath(teamA.id)}/${users.sB.id}`).set("Authorization", within));
    expectHidden(await app.delete(`${membersPath(teamA.id)}/0`).set("Authorization", within));
    errorCode(await malformed(membersPath(teamA.id), within), 400, "BAD_REQUEST");
    expect(await prisma().teamMember.count()).toBe(2);
    expect(await prisma().team.count()).toBe(2);
  });
});
