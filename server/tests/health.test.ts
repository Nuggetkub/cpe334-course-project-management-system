import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { disconnectPrisma } from "../src/prisma.js";

afterAll(async () => {
  await disconnectPrisma();
});

describe("GET /api/health", () => {
  it("returns 200 { status: 'ok' } without touching the database", async () => {
    const app = createApp({
      checkDatabase: () => Promise.reject(new Error("must not be called")),
    });

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /api/ready", () => {
  it("returns 200 { status: 'ready', db: 'connected' } against the real database", async () => {
    const res = await request(createApp()).get("/api/ready");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready", db: "connected" });
  });

  it("returns 503 when the database is unreachable", async () => {
    const app = createApp({
      checkDatabase: () => Promise.reject(new Error("connection refused")),
    });

    const res = await request(app).get("/api/ready");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "not ready", db: "disconnected" });
  });
});

describe("unknown API routes", () => {
  it("return JSON 404, not the SPA", async () => {
    const res = await request(createApp()).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
  });
});

describe("serving the built client", () => {
  const dist = mkdtempSync(path.join(tmpdir(), "cpms-dist-"));
  writeFileSync(path.join(dist, "index.html"), "<!doctype html><title>CPMS</title>");
  const app = createApp({ clientDistDir: dist });

  it("serves index.html at /", async () => {
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>CPMS</title>");
  });

  it("falls back to index.html for client-side routes", async () => {
    const res = await request(app).get("/milestones/3");

    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>CPMS</title>");
  });

  it("still answers unknown /api routes with JSON 404", async () => {
    const res = await request(app).get("/api/nope");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
  });
});
