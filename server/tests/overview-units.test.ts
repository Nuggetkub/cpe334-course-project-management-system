import { describe, expect, it } from "vitest";
import { teamStatus } from "../src/milestones/status.js";
import { feedbackState, submissionState } from "../src/overview/states.js";

// F-12 contract v0.2 §1 "Row states" and §4: TEST-12.1u. One server instant per call.
const D = new Date("2026-11-28T12:00:00Z");
const before = new Date(D.getTime() - 1000);
const after = new Date(D.getTime() + 1000);

describe("F-12 unit contract", () => {
  it("TEST-12.1u gives LATE, SUBMITTED, MISSING and NOT_DUE exactly as the §1 table (first match wins)", () => {
    expect(submissionState(D, { late: true }, before)).toBe("LATE");
    expect(submissionState(D, { late: true }, after)).toBe("LATE");
    expect(submissionState(D, { late: false }, before)).toBe("SUBMITTED");
    expect(submissionState(D, { late: false }, after)).toBe("SUBMITTED");
    expect(submissionState(D, null, after)).toBe("MISSING");
    expect(submissionState(D, null, before)).toBe("NOT_DUE");
    // The deadline itself is inclusive (SRS §4.3.1): at dueAt nothing is missing yet.
    expect(submissionState(D, null, D)).toBe("NOT_DUE");
  });

  it("TEST-12.1u follows the F-09 teamStatus mapping (DEC-13), so the board and the milestone page agree", () => {
    const map = { LATE: "LATE", SUBMITTED: "SUBMITTED", OVERDUE: "MISSING", NOT_SUBMITTED: "NOT_DUE" } as const;
    for (const latest of [null, { late: false }, { late: true }]) {
      for (const now of [before, D, after]) {
        expect(submissionState(D, latest, now)).toBe(map[teamStatus(D, latest, now)]);
      }
    }
  });

  it("TEST-12.1u gives NONE, AWAITING and RECEIVED from the latest version's own feedback", () => {
    expect(feedbackState(null)).toBe("NONE");
    expect(feedbackState({ feedbackCount: 0 })).toBe("AWAITING");
    expect(feedbackState({ feedbackCount: 1 })).toBe("RECEIVED");
    expect(feedbackState({ feedbackCount: 4 })).toBe("RECEIVED");
  });
});
