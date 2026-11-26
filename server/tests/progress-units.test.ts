import { describe, expect, it } from "vitest";
import { submissionWindow, teamStatus } from "../src/milestones/status.js";
import { progressRow, type ProgressMilestone } from "../src/progress/rows.js";

// F-11 contract v0.3 §4: TEST-11.2u (feedback status of the latest version; phase 1 has no grade).
const D = new Date("2026-11-28T12:00:00Z");
const before = new Date(D.getTime() - 1000);
const after = new Date(D.getTime() + 1000);
const milestone: ProgressMilestone = { id: 7, title: "Prototype", dueAt: D, lateUntil: null, closedAt: null };
const latest = (feedbackCount: number, version = 1, late = false) => ({ version, late, submittedAt: before, feedbackCount });

describe("F-11 unit contract", () => {
  it("TEST-11.2u gives NONE and a null latest when nothing was submitted", () => {
    const row = progressRow(milestone, null, before);
    expect(row).toEqual({
      milestoneId: 7, title: "Prototype", dueAt: D, window: "OPEN", teamStatus: "NOT_SUBMITTED", latest: null, feedbackStatus: "NONE",
    });
  });

  it("TEST-11.2u gives AWAITING for a latest version with no feedback and RECEIVED with 1 or more", () => {
    expect(progressRow(milestone, latest(0), before).feedbackStatus).toBe("AWAITING");
    expect(progressRow(milestone, latest(1), before).feedbackStatus).toBe("RECEIVED");
    expect(progressRow(milestone, latest(3), before).feedbackStatus).toBe("RECEIVED");
  });

  it("TEST-11.2u gives AWAITING when only an older version has feedback (BR-10)", () => {
    // The count is for the latest version only, so feedback on version 1 is not counted for version 2.
    const row = progressRow(milestone, latest(0, 2, true), after);
    expect(row.latest).toEqual({ version: 2, late: true, submittedAt: before });
    expect(row.latest).not.toHaveProperty("feedbackCount");
    expect(row.feedbackStatus).toBe("AWAITING");
  });

  it("TEST-11.2u reuses the F-08/F-09 window and team status functions", () => {
    const late = { ...milestone, lateUntil: new Date(D.getTime() + 3600_000) };
    const closed = { ...milestone, closedAt: before };
    for (const [m, l, now] of [[milestone, null, after], [late, latest(0, 1, true), after], [closed, latest(1), after], [milestone, latest(0), before]] as const) {
      const row = progressRow(m, l, now);
      expect(row.window).toBe(submissionWindow(m, now));
      expect(row.teamStatus).toBe(teamStatus(m.dueAt, l, now));
    }
  });

  it("TEST-11.2u phase 1 rows have no grade key", () => {
    expect(progressRow(milestone, null, before)).not.toHaveProperty("grade");
    expect(progressRow(milestone, latest(1), before)).not.toHaveProperty("grade");
  });
});
