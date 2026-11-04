import express from "express";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { assertTeamAccess, requireRole, requireTeamAccess, teamScope } from "../src/auth/authorize.js";
import { requireAuth } from "../src/auth/middleware.js";
import { HttpError, errorHandler, notFound } from "../src/errors.js";
import { disconnectPrisma, prisma } from "../src/prisma.js";
import { NOT_FOUND, UNAUTHENTICATED, expectForbidden, expectHidden } from "./support/authz.js";
import { PROTECTED_ENDPOINTS, concretePath } from "./support/protected-endpoints.js";
import { cleanDatabase, createTeamsFixture, signIn } from "./support/teams.js";

// Test-only probe routes on the real middleware (F-02 contract §4). They are never
// mounted in createApp; the real team-scoped endpoints arrive with F-03.2–F-06.
let handlerRuns = 0;
const probe = express();
probe.use(express.json());
probe.get("/probe/supervisor-only", requireAuth, requireRole("SUPERVISOR"), (_req, res) => {
  handlerRuns += 1;
  res.json({ ok: true });
});
probe.get("/probe/student-only", requireAuth, requireRole("STUDENT"), (_req, res) => {
  handlerRuns += 1;
  res.json({ ok: true });
});
probe.get("/probe/teams/:teamId", requireAuth, requireTeamAccess, (req, res) => {
  handlerRuns += 1;
  res.json({ teamId: req.team!.id });
});
probe.post("/probe/teams/:teamId/supervise", requireAuth, requireRole("SUPERVISOR"), requireTeamAccess, (req, res) => {
  handlerRuns += 1;
  res.json({ teamId: req.team!.id });
});
probe.use(notFound);
probe.use(errorHandler);

type Fixture = Awaited<ReturnType<typeof createTeamsFixture>>;
let fx: Fixture;
let tokens: Record<keyof Fixture["users"], string>;

function as(user: keyof Fixture["users"]) {
  const auth = { Authorization: `Bearer ${tokens[user]}` };
  return {
    get: (path: string) => request(probe).get(path).set(auth),
    post: (path: string) => request(probe).post(path).set(auth).send({}),
  };
}

function authUser(user: keyof Fixture["users"]) {
  const { id, role } = fx.users[user];
  return { id, role, sessionId: 0 };
}

beforeEach(async () => {
  await cleanDatabase();
  handlerRuns = 0;
  fx = await createTeamsFixture();
  const entries = await Promise.all(
    Object.entries(fx.users).map(async ([key, user]) => [key, await signIn(user.id)] as const),
  );
  tokens = Object.fromEntries(entries) as typeof tokens;
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectPrisma();
});

describe("authentication on every protected endpoint (AC-02.1)", () => {
  const app = createApp({ clientDistDir: null });
  const badHeaders: Array<[string, string | undefined]> = [
    ["no header", undefined],
    ["another scheme", "Basic dXNlcjpwYXNz"],
    ["an empty bearer token", "Bearer "],
    ["an unknown token", `Bearer ${"A".repeat(43)}`],
  ];

  for (const endpoint of PROTECTED_ENDPOINTS) {
    for (const [label, header] of badHeaders) {
      it(`TEST-02.1 ${endpoint.method.toUpperCase()} ${endpoint.path} (${endpoint.feature}) rejects ${label}`, async () => {
        const req = request(app)[endpoint.method](concretePath(endpoint.path));
        const res = await (header ? req.set("Authorization", header) : req);

        expect(res.status).toBe(401);
        expect(res.body).toEqual(UNAUTHENTICATED);
      });
    }
  }
});

describe("role checks (AC-02.2)", () => {
  it("TEST-02.2a lets only a Supervisor through a Supervisor-only operation", async () => {
    expectForbidden(await as("sA").get("/probe/supervisor-only"));
    expect(handlerRuns).toBe(0);

    const ok = await as("pA").get("/probe/supervisor-only");
    expect(ok.status).toBe(200);
  });

  it("TEST-02.2b lets only a Student through a Student-only operation", async () => {
    expectForbidden(await as("pA").get("/probe/student-only"));
    expect(handlerRuns).toBe(0);

    const ok = await as("sA").get("/probe/student-only");
    expect(ok.status).toBe(200);
  });

  it("TEST-02.2c checks the role before ownership, even on the student's own team", async () => {
    expectForbidden(await as("sA").post(`/probe/teams/${fx.teamA.id}/supervise`));
    expect(handlerRuns).toBe(0);
  });
});

describe("supervisor ownership (AC-02.3)", () => {
  it("TEST-02.3a hides an unassigned team exactly like a nonexistent one", async () => {
    const other = await as("pB").get(`/probe/teams/${fx.teamA.id}`);
    const missing = await as("pB").get("/probe/teams/999999");

    expectHidden(other);
    expectHidden(missing);
    expect(other.body).toEqual(missing.body);
    expect(handlerRuns).toBe(0);
  });

  it("TEST-02.3b lets every assigned supervisor through (co-supervision)", async () => {
    for (const user of ["pA", "pA2"] as const) {
      const read = await as(user).get(`/probe/teams/${fx.teamA.id}`);
      expect(read.status).toBe(200);
      expect(read.body).toEqual({ teamId: fx.teamA.id });

      const act = await as(user).post(`/probe/teams/${fx.teamA.id}/supervise`);
      expect(act.status).toBe(200);
      expect(act.body).toEqual({ teamId: fx.teamA.id });
    }
  });

  it("TEST-02.3c scopes a supervisor's team list to assigned teams", async () => {
    const ids = async (user: "pA" | "pB") =>
      (await prisma().team.findMany({ where: teamScope(authUser(user)), select: { id: true } })).map((t) => t.id);

    expect(await ids("pA")).toEqual([fx.teamA.id]);
    expect(await ids("pB")).toEqual([fx.teamB.id]);
  });
});

describe("student ownership (AC-02.4)", () => {
  it("TEST-02.4a allows the own team and hides another team like a nonexistent one", async () => {
    const own = await as("sA").get(`/probe/teams/${fx.teamA.id}`);
    expect(own.status).toBe(200);
    expect(own.body).toEqual({ teamId: fx.teamA.id });

    const other = await as("sA").get(`/probe/teams/${fx.teamB.id}`);
    const missing = await as("sA").get("/probe/teams/999999");
    expectHidden(other);
    expectHidden(missing);
    expect(other.body).toEqual(missing.body);
  });

  it("TEST-02.4b gives a student with no team nothing (BR-04)", async () => {
    expectHidden(await as("s0").get(`/probe/teams/${fx.teamA.id}`));
    expectHidden(await as("s0").get(`/probe/teams/${fx.teamB.id}`));
    expect(await prisma().team.count({ where: teamScope(authUser("s0")) })).toBe(0);
    expect(handlerRuns).toBe(0);
  });

  it("TEST-02.4c scopes a student's team list to their own team", async () => {
    const ids = async (user: "sA" | "sB") =>
      (await prisma().team.findMany({ where: teamScope(authUser(user)), select: { id: true } })).map((t) => t.id);

    expect(await ids("sA")).toEqual([fx.teamA.id]);
    expect(await ids("sB")).toEqual([fx.teamB.id]);
  });

  it("TEST-02.4d checks a supervisor only against supervisor assignments", async () => {
    // Bad data: a supervisor row in team_members must not grant access.
    await prisma().teamMember.create({ data: { studentId: fx.users.pB.id, teamId: fx.teamA.id } });

    expectHidden(await as("pB").get(`/probe/teams/${fx.teamA.id}`));
  });
});

describe("IDs and check order (AC-02.5)", () => {
  it("TEST-02.5b answers malformed or out-of-range team IDs with 404, never 500", async () => {
    for (const id of ["abc", "0", "01", "2147483648"]) {
      const res = await as("sA").get(`/probe/teams/${id}`);
      expect(res.body, id).toEqual(NOT_FOUND);
      expect(res.status, id).toBe(404);
    }
  });

  it("TEST-02.5c authenticates before checking role or ownership", async () => {
    const res = await request(probe).post(`/probe/teams/${fx.teamB.id}/supervise`).send({});

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHENTICATED);
  });

  it("TEST-02.5d assertTeamAccess guards nested records directly", async () => {
    await expect(assertTeamAccess(authUser("sA"), fx.teamA.id)).resolves.toBeUndefined();

    for (const user of ["sB", "pB"] as const) {
      const error = await assertTeamAccess(authUser(user), fx.teamA.id).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({ status: 404, code: "NOT_FOUND", message: "Not found" });
    }
  });
});
