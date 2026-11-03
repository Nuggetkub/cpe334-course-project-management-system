import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/auth/password.js";
import { computeExpiry, isExpired } from "../src/auth/session.js";

describe("session expiry (NFR-04)", () => {
  const created = new Date("2026-11-08T00:00:00Z");
  const expiry = computeExpiry(created);

  it("TEST-01.5a expires exactly 8 hours after login", () => {
    expect(expiry.toISOString()).toBe("2026-11-08T08:00:00.000Z");
  });

  it("TEST-01.5a is valid 1 s before expiry and rejected at and after it", () => {
    expect(isExpired(expiry, new Date("2026-11-08T07:59:59Z"))).toBe(false);
    expect(isExpired(expiry, new Date("2026-11-08T08:00:00Z"))).toBe(true);
    expect(isExpired(expiry, new Date("2026-11-08T08:00:01Z"))).toBe(true);
  });
});

describe("password hashing (NFR-01)", () => {
  it("TEST-01.6a hashes with bcrypt at the given cost and verifies", async () => {
    const hash = await hashPassword("s3cret-pass", 10);

    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(await verifyPassword("s3cret-pass", hash)).toBe(true);
    expect(await verifyPassword("wrong-pass", hash)).toBe(false);
  });

  it("TEST-01.6a defaults to cost 12", async () => {
    expect(await hashPassword("s3cret-pass")).toMatch(/^\$2[aby]\$12\$/);
  });

  it("TEST-01.6a refuses a cost below 10", async () => {
    await expect(hashPassword("s3cret-pass", 9)).rejects.toThrow(/cost/i);
  });
});
