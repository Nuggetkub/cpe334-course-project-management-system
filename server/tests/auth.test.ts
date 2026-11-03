import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { disconnectPrisma, prisma } from "../src/prisma.js";
import { TEST_PASSWORD, createUser } from "./support/users.js";

const app = createApp();
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
const INVALID_CREDENTIALS = {
  error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" },
};
const UNAUTHENTICATED = { error: { code: "UNAUTHENTICATED", message: "Sign in to continue" } };

function login(email: string, password = TEST_PASSWORD) {
  return request(app).post("/api/auth/login").send({ email, password });
}

function keysDeep(value: unknown): string[] {
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...keysDeep(child)]);
}

beforeEach(async () => {
  await prisma().session.deleteMany();
  await prisma().user.deleteMany();
});

afterAll(async () => {
  await disconnectPrisma();
});

describe("POST /api/auth/login", () => {
  it("TEST-01.1 returns a token and the user, and stores a hashed 8-hour session", async () => {
    const user = await createUser("STUDENT");

    const res = await login(`  ${user.email.toUpperCase()} `);

    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body.user).toEqual({ id: user.id, name: user.name, email: user.email, role: "STUDENT" });

    const sessions = await prisma().session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).not.toBe(res.body.token);
    expect(sessions[0].expiresAt.getTime() - sessions[0].createdAt.getTime()).toBe(EIGHT_HOURS_MS);
  });

  it("TEST-01.2a rejects a wrong password with 401 and creates no session", async () => {
    const user = await createUser();

    const res = await login(user.email, "wrong-password");

    expect(res.status).toBe(401);
    expect(res.body).toEqual(INVALID_CREDENTIALS);
    expect(await prisma().session.count()).toBe(0);
  });

  it("TEST-01.2b answers an unknown email exactly like a wrong password", async () => {
    const res = await login("nobody@example.test");

    expect(res.status).toBe(401);
    expect(res.body).toEqual(INVALID_CREDENTIALS);
  });

  it("TEST-01.2c rejects invalid input with 400 and field errors", async () => {
    const empty = await request(app).post("/api/auth/login").send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(empty.body.error.fields).sort()).toEqual(["email", "password"]);

    const badEmail = await login("not-an-email", "x");
    expect(badEmail.status).toBe(400);
    expect(Object.keys(badEmail.body.error.fields)).toEqual(["email"]);

    const longPassword = await login("someone@example.test", "x".repeat(129));
    expect(longPassword.status).toBe(400);
    expect(Object.keys(longPassword.body.error.fields)).toEqual(["password"]);
  });
});

describe("password byte limit at login (AC-01.2, NFR-01)", () => {
  const ascii72 = "a".repeat(72);

  it("TEST-01.2d accepts a 72-byte password and rejects 73 bytes with a field error", async () => {
    const user = await createUser("STUDENT", ascii72);

    const ok = await login(user.email, ascii72);
    expect(ok.status).toBe(200);

    const tooLong = await login(user.email, `${ascii72}X`);
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(tooLong.body.error.fields)).toEqual(["password"]);
  });

  it("TEST-01.2d measures bytes, not characters (25 Thai characters = 75 bytes)", async () => {
    const res = await login("someone@example.test", "ก".repeat(25));

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(["password"]);
  });
});

describe("GET /api/auth/me", () => {
  it("TEST-01.3 returns the signed-in user", async () => {
    const user = await createUser("SUPERVISOR");
    const { body } = await login(user.email);

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${body.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: body.user });
  });

  it("TEST-01.5b rejects an expired session and deletes it", async () => {
    const user = await createUser();
    const { body } = await login(user.email);
    await prisma().session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${body.token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHENTICATED);
    expect(await prisma().session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("TEST-01.6b never returns password fields", async () => {
    const user = await createUser();
    const loginRes = await login(user.email);
    const meRes = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${loginRes.body.token}`);

    expect(loginRes.status).toBe(200);
    expect(meRes.status).toBe(200);
    for (const body of [loginRes.body, meRes.body]) {
      const keys = keysDeep(body).map((key) => key.toLowerCase());
      expect(keys).not.toContain("password");
      expect(keys).not.toContain("passwordhash");
    }
  });
});

describe("POST /api/auth/logout", () => {
  it("TEST-01.4 deletes the session so the same token is rejected", async () => {
    const user = await createUser();
    const { body } = await login(user.email);
    const auth = `Bearer ${body.token}`;

    const res = await request(app).post("/api/auth/logout").set("Authorization", auth).send({});

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(await prisma().session.count({ where: { userId: user.id } })).toBe(0);

    const after = await request(app).get("/api/auth/me").set("Authorization", auth);
    expect(after.status).toBe(401);
    expect(after.body).toEqual(UNAUTHENTICATED);
  });

  it("TEST-01.4b ends only the presented session", async () => {
    const user = await createUser();
    const a = await login(user.email);
    const b = await login(user.email);

    const out = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${a.body.token}`);
    expect(out.status).toBe(204);

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${b.body.token}`);
    expect(res.status).toBe(200);
  });
});

describe("authentication required (AC-02.1 for the auth endpoints)", () => {
  const badHeaders: Array<[string, string | undefined]> = [
    ["no header", undefined],
    ["another scheme", "Basic dXNlcjpwYXNz"],
    ["an empty bearer token", "Bearer "],
    ["an unknown token", `Bearer ${"A".repeat(43)}`],
  ];

  for (const [label, header] of badHeaders) {
    it(`TEST-02.1-auth rejects ${label} on /me and /logout with 401`, async () => {
      for (const [method, path] of [["get", "/api/auth/me"], ["post", "/api/auth/logout"]] as const) {
        const req = request(app)[method](path);
        const res = await (header ? req.set("Authorization", header) : req);

        expect(res.status).toBe(401);
        expect(res.body).toEqual(UNAUTHENTICATED);
      }
    });
  }
});

describe("error shape (AC-SR1.1)", () => {
  it("TEST-SR1.1-auth uses { error: { code, message } } for 404 and malformed JSON", async () => {
    const notFound = await request(app).get("/api/x");
    expect(notFound.status).toBe(404);
    expect(notFound.body).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });

    const malformed = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ error: { code: "BAD_REQUEST", message: "Request body is not valid JSON" } });
  });
});
