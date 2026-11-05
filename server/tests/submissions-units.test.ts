import { describe, expect, it } from "vitest";
import { submissionWindow, teamStatus } from "../src/milestones/status.js";

const due = new Date("2026-11-08T16:59:59.000Z");
const at = (ms: number) => new Date(due.getTime() + ms);

describe("F-05 deadline and team status rules", () => {
  it.each([[-1000, "OPEN"], [0, "OPEN"], [1, "CLOSED"], [1000, "CLOSED"]] as const)(
    "TEST-05.3a window at due %+d ms is %s",
    (offset, expected) => {
      expect(submissionWindow(due, at(offset))).toBe(expected);
    },
  );

  it.each([
    [false, 0, "NOT_SUBMITTED"],
    [false, 1000, "OVERDUE"],
    [true, -1000, "SUBMITTED"],
    [true, 24 * 60 * 60 * 1000, "SUBMITTED"],
  ] as const)("TEST-05.8a team status with submission=%s at due %+d ms is %s", (hasSubmission, offset, expected) => {
    expect(teamStatus(due, hasSubmission, at(offset))).toBe(expected);
  });
});
