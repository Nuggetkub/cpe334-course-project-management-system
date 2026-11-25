import { describe, expect, it } from "vitest";
import { teamStatus } from "../src/milestones/status.js";
import { insertNextVersion } from "../src/submissions/versions.js";

// F-09 contract §4: TEST-09.2u (team status with the latest version) and TEST-09.6u (retry helper).
const D = new Date("2026-11-28T12:00:00Z");
const before = new Date(D.getTime() - 1000);
const after = new Date(D.getTime() + 1000);

describe("F-09 unit contract", () => {
  it("TEST-09.2u derives the team status from the latest version", () => {
    expect(teamStatus(D, { late: true }, after)).toBe("LATE");
    expect(teamStatus(D, { late: false }, after)).toBe("SUBMITTED");
    expect(teamStatus(D, { late: false }, before)).toBe("SUBMITTED");
    expect(teamStatus(D, null, before)).toBe("NOT_SUBMITTED");
    expect(teamStatus(D, null, after)).toBe("OVERDUE");
  });

  // A fake version store: an attempt reads max(version) and inserts max + 1, as the real one does in
  // its own transaction. A duplicate version is a (milestone_id, version) uniqueness collision, with
  // the meta Prisma 5.22 reports for that index on PostgreSQL.
  function store(initial: number[]) {
    const versions = [...initial];
    let attempts = 0;
    const collision = () => Object.assign(new Error("Unique constraint failed"), {
      code: "P2002", meta: { modelName: "Submission", target: ["milestone_id", "version"] },
    });
    return {
      versions,
      get attempts() { return attempts; },
      attempt(beforeInsert?: () => void) {
        return async () => {
          attempts += 1;
          const next = Math.max(...versions) + 1; // read in this attempt
          beforeInsert?.();
          if (versions.includes(next)) throw collision();
          versions.push(next);
          return { version: next };
        };
      },
    };
  }

  it("TEST-09.6u retries a collision in a fresh attempt that re-reads the latest version", async () => {
    const s = store([1]);
    let first = true;
    const attempt = s.attempt(() => { if (first) { first = false; s.versions.push(2); } }); // a teammate wins v2
    await expect(insertNextVersion(attempt)).resolves.toEqual({ version: 3 });
    expect(s.attempts).toBe(2);
    expect([...s.versions].sort()).toEqual([1, 2, 3]);
  });

  it("TEST-09.6u returns 409 SUBMISSION_CONFLICT only after the retry budget is used up", async () => {
    const s = store([1]);
    const alwaysCollides = async () => {
      await s.attempt(() => s.versions.push(Math.max(...s.versions) + 1))(); // someone always gets there first
    };
    await expect(insertNextVersion(alwaysCollides)).rejects.toMatchObject({
      status: 409, code: "SUBMISSION_CONFLICT", message: "Another submission was saved at the same moment. Please try again.",
    });
    expect(s.attempts).toBe(3);
  });

  it("TEST-09.6u rethrows any other error without retrying", async () => {
    let calls = 0;
    const boom = new Error("connection lost");
    await expect(insertNextVersion(async () => { calls += 1; throw boom; })).rejects.toBe(boom);
    expect(calls).toBe(1);
  });

  it("TEST-09.6u rethrows a P2002 on any other unique constraint without retrying", async () => {
    const unrelated = [
      Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { modelName: "Course", target: ["code"] } }),
      Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { modelName: "Submission", target: ["milestone_id"] } }),
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }), // no target: can't be shown to be ours
    ];
    for (const error of unrelated) {
      let calls = 0;
      await expect(insertNextVersion(async () => { calls += 1; throw error; })).rejects.toBe(error);
      expect(calls).toBe(1);
    }
  });
});
