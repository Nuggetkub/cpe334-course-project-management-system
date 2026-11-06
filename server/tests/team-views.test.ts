import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { disconnectPrisma, prisma } from "../src/prisma.js";
import { expectForbidden, expectHidden } from "./support/authz.js";
import { cleanDatabase, createTeamsFixture, signIn } from "./support/teams.js";

const app = createApp({ clientDistDir: null });
let fixture: Awaited<ReturnType<typeof createTeamsFixture>>;

async function getAs(user: keyof typeof fixture.users, path: string) {
  const token = await signIn(fixture.users[user].id);
  return request(app).get(path).set("Authorization", `Bearer ${token}`);
}

const summary = ({ id, name }: { id: number; name: string }) => ({ id, name });

beforeEach(async () => {
  await cleanDatabase();
  fixture = await createTeamsFixture();
});

afterAll(async () => {
  try {
    await cleanDatabase();
  } finally {
    await disconnectPrisma();
  }
});

describe("F-03.2 protected team views", () => {
  it("TEST-03.3 returns only the student's own team and public roster fields", async () => {
    const { teamA, teamB, users } = fixture;
    const res = await getAs("sA", `/api/teams/mine?teamId=${teamB.id}&userId=${users.sB.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      team: {
        ...summary(teamA),
        members: [summary(users.sA)],
        supervisors: [summary(users.pA), summary(users.pA2)],
      },
    });
  });

  it("TEST-03.4 hides the team from a student without membership", async () => {
    expectHidden(await getAs("s0", "/api/teams/mine"));
  });

  it("TEST-03.6 lists only the supervisor's assigned teams, including co-supervision", async () => {
    const { teamA, users } = fixture;
    const res = await getAs("pA2", `/api/teams?userId=${users.pB.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ teams: [summary(teamA)] });
  });

  it("TEST-03.7 returns an empty list for an unassigned supervisor", async () => {
    await prisma().supervisorTeam.deleteMany({ where: { supervisorId: fixture.users.pA.id } });
    const res = await getAs("pA", "/api/teams");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ teams: [] });
  });

  it("TEST-03.8 rejects the wrong role on both endpoints", async () => {
    expectForbidden(await getAs("sA", "/api/teams"));
    expectForbidden(await getAs("pA", "/api/teams/mine"));
  });
});
