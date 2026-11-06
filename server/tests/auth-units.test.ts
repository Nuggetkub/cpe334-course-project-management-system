import { describe, expect, it, vi } from "vitest";
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

describe("password byte limit (bcrypt uses only the first 72 bytes)", () => {
  const ascii72 = "a".repeat(72);
  const twoByte72 = "é".repeat(36); // 2 bytes each in UTF-8
  const thai72 = "ก".repeat(24); // 3 bytes each in UTF-8

  it("TEST-01.6c accepts passwords of exactly 72 UTF-8 bytes", async () => {
    for (const password of [ascii72, twoByte72, thai72]) {
      expect(Buffer.byteLength(password, "utf8")).toBe(72);
      const hash = await hashPassword(password, 10);
      expect(await verifyPassword(password, hash)).toBe(true);
    }
  });

  it("TEST-01.6c rejects passwords over 72 UTF-8 bytes instead of truncating them", async () => {
    for (const password of [`${ascii72}X`, `${twoByte72}a`, "ก".repeat(25)]) {
      expect(Buffer.byteLength(password, "utf8")).toBeGreaterThan(72);
      await expect(hashPassword(password, 10)).rejects.toThrow(/72 bytes/);
    }
  });

  it("TEST-01.6c never treats two passwords that differ only after byte 72 as equal", async () => {
    const hash = await hashPassword(ascii72, 10);

    expect(await verifyPassword(`${ascii72}X`, hash)).toBe(false);
    expect(await verifyPassword(`${ascii72}Y`, hash)).toBe(false);
  });
});

describe("session lifetime is fixed (NFR-04)", () => {
  it("TEST-01.5c ignores a SESSION_TTL_HOURS override and still expires after 8 hours", async () => {
    vi.resetModules();
    vi.stubEnv("SESSION_TTL_HOURS", "24");
    try {
      const session = await import("../src/auth/session.js");
      const created = new Date("2026-11-08T00:00:00Z");

      expect(session.computeExpiry(created).toISOString()).toBe("2026-11-08T08:00:00.000Z");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
