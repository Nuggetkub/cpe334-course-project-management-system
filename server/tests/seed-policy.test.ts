import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { readSeedConfig, SeedError, seedFailureMessage } from "../prisma/demo-seed.js";

describe("TEST-03.1b demo seed configuration", () => {
  it("requires explicit opt-in", () => {
    expect(readSeedConfig({})).toBeNull();
    expect(readSeedConfig({ SEED_DEMO_DATA: "false" })).toBeNull();
    expect(() => readSeedConfig({ SEED_DEMO_DATA: "yes" })).toThrow(/SEED_DEMO_DATA/);
  });

  it.each([undefined, "   ", "ก".repeat(25)])("rejects invalid student passwords", (password) => {
    expect(() => readSeedConfig({
      SEED_DEMO_DATA: "true",
      STUDENT_DEMO_PASSWORD: password,
      SUPERVISOR_DEMO_PASSWORD: "synthetic-test-only",
    })).toThrow(/STUDENT_DEMO_PASSWORD/);
  });

  it("preserves valid whitespace and rejects a missing supervisor password", () => {
    const env = { SEED_DEMO_DATA: "true", STUDENT_DEMO_PASSWORD: " test password " };
    expect(() => readSeedConfig(env)).toThrow(/SUPERVISOR_DEMO_PASSWORD/);
    expect(readSeedConfig({ ...env, SUPERVISOR_DEMO_PASSWORD: "ก".repeat(24) }))
      .toEqual({ studentPassword: env.STUDENT_DEMO_PASSWORD, supervisorPassword: "ก".repeat(24) });
  });
});

describe("TEST-03.1d safe seed diagnostics", () => {
  it("preserves known seed messages and distinguishes Prisma initialization and request errors", () => {
    expect(seedFailureMessage(new SeedError("Demo account role conflict."))).toBe("Demo account role conflict.");
    expect(seedFailureMessage(new Prisma.PrismaClientInitializationError("private URL", "5.22.0", "P1001")))
      .toBe("Failed to seed demo data (PrismaClientInitializationError P1001).");
    expect(seedFailureMessage(new Prisma.PrismaClientKnownRequestError("private inputs", {
      code: "P2002", clientVersion: "5.22.0", meta: { input: "private hash" },
    }))).toBe("Failed to seed demo data (PrismaClientKnownRequestError P2002).");
  });

  it("never logs arbitrary error names, messages or unrecognized code text", () => {
    expect(seedFailureMessage(Object.assign(new Error("private URL"), { name: "private input", code: "P1001" })))
      .toBe("Failed to seed demo data (UnexpectedError).");
    expect(seedFailureMessage(new Prisma.PrismaClientInitializationError("private URL", "5.22.0", "private code")))
      .toBe("Failed to seed demo data (PrismaClientInitializationError).");
  });
});
