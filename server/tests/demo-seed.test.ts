import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { seedDemo } from "../prisma/demo-seed.js";
import { createApp } from "../src/app.js";
import { disconnectPrisma } from "../src/prisma.js";

const db = new PrismaClient();
const env = {
  SEED_DEMO_DATA: "true",
  STUDENT_DEMO_PASSWORD: "synthetic-student-test",
  SUPERVISOR_DEMO_PASSWORD: "synthetic-supervisor-test",
};

afterEach(async () => {
  await db.$transaction([
    db.supervisorTeam.deleteMany(), db.teamMember.deleteMany(),
    db.team.deleteMany(), db.course.deleteMany(),
    db.session.deleteMany(), db.user.deleteMany(),
  ]);
});

afterAll(async () => {
  await db.$disconnect();
  await disconnectPrisma();
});

describe("F-03.1 demo seed", () => {
  it("TEST-03.1a / TEST-03.2 preserves rows and hashes on rerun; both roles can sign in", async () => {
    await seedDemo(db, env);
    const snapshot = () => db.$transaction([
      db.course.findMany({ orderBy: { id: "asc" } }),
      db.team.findMany({ orderBy: { id: "asc" } }),
      db.user.findMany({ orderBy: { id: "asc" } }),
      db.teamMember.findMany({ orderBy: { studentId: "asc" } }),
      db.supervisorTeam.findMany({ orderBy: { supervisorId: "asc" } }),
    ]);
    const first = await snapshot();
    expect(first.map((rows) => rows.length)).toEqual([1, 2, 7, 4, 2]);
    expect(new Set(first[4].map((row) => row.teamId)).size).toBe(2);
    const smoke = first[2].find((user) => user.email === "smoke.student@example.test")!;
    expect(smoke.role).toBe("STUDENT");
    expect(first[3].some((member) => member.studentId === smoke.id)).toBe(false);
    await seedDemo(db, { ...env, STUDENT_DEMO_PASSWORD: "different-initial-password" });
    expect(await snapshot()).toEqual(first);

    const app = createApp({ clientDistDir: null });
    for (const role of ["STUDENT", "SUPERVISOR"] as const) {
      const user = first[2].find((row) => row.role === role)!;
      expect(user.passwordHash).toMatch(/^\$2[aby]\$(?:1\d|2\d|3[01])\$/);
      const response = await request(app).post("/api/auth/login").send({
        email: user.email, password: env[`${role}_DEMO_PASSWORD`],
      });
      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({ id: user.id, role });
    }
  });

  it("TEST-03.1b does not write when disabled or invalid", async () => {
    await seedDemo(db, {});
    await expect(seedDemo(db, { SEED_DEMO_DATA: "true" })).rejects.toThrow(/PASSWORD/);
    expect(await db.course.count()).toBe(0);
    expect(await db.user.count()).toBe(0);
  });

  it("TEST-03.1c rolls back on a role conflict without overwriting the existing account", async () => {
    const existing = await db.user.create({ data: {
      email: "smoke.student@example.test", name: "Existing", role: "SUPERVISOR", passwordHash: "fixture",
    } });
    await expect(seedDemo(db, env)).rejects.toThrow(/role/i);
    expect(await db.course.count()).toBe(0);
    expect(await db.user.findMany()).toEqual([existing]);
  });

  it("TEST-03.5 rejects a second membership and TEST-03.1c refuses to reassign", async () => {
    await seedDemo(db, env);
    const member = await db.teamMember.findFirstOrThrow();
    const otherTeam = await db.team.findFirstOrThrow({ where: { id: { not: member.teamId } } });
    const otherMembership = { studentId: member.studentId, teamId: otherTeam.id };
    await expect(db.teamMember.create({ data: otherMembership })).rejects.toMatchObject({ code: "P2002" });
    await db.teamMember.update({ where: { studentId: member.studentId }, data: { teamId: otherTeam.id } });
    await expect(seedDemo(db, env)).rejects.toThrow(/membership/i);
    expect(await db.teamMember.findUnique({ where: { studentId: member.studentId } })).toMatchObject(otherMembership);
  });
});
