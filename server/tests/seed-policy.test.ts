import { describe, expect, it } from "vitest";
import { readSeedConfig } from "../prisma/demo-seed.js";

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
