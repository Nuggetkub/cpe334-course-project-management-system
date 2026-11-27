import { describe, expect, it } from "vitest";
import { submissionWindow, teamStatus } from "../src/milestones/status.js";
import { progressRow, type ProgressMilestone } from "../src/progress/rows.js";

// F-11 contract v0.6 §4: TEST-11.2u (feedback status of the latest version) and TEST-11.3u (phase 2: the grade
// comes only from F-10's released snapshot).
const D = new Date("2026-11-28T12:00:00Z");
const before = new Date(D.getTime() - 1000);
const after = new Date(D.getTime() + 1000);
const milestone: ProgressMilestone = { id: 7, title: "Prototype", dueAt: D, lateUntil: null, closedAt: null };
const latest = (feedbackCount: number, version = 1, late = false) => ({ version, late, submittedAt: before, feedbackCount });

describe("F-11 unit contract", () => {
  it("TEST-11.2u gives NONE and a null latest when nothing was submitted", () => {
    const row = progressRow(milestone, null, before, null);
    expect(row).toEqual({
      milestoneId: 7, title: "Prototype", dueAt: D, window: "OPEN", teamStatus: "NOT_SUBMITTED", latest: null, feedbackStatus: "NONE",
      grade: { released: false },
    });
  });

  it("TEST-11.2u gives AWAITING for a latest version with no feedback and RECEIVED with 1 or more", () => {
    expect(progressRow(milestone, latest(0), before, null).feedbackStatus).toBe("AWAITING");
    expect(progressRow(milestone, latest(1), before, null).feedbackStatus).toBe("RECEIVED");
    expect(progressRow(milestone, latest(3), before, null).feedbackStatus).toBe("RECEIVED");
  });

  it("TEST-11.2u gives AWAITING when only an older version has feedback (BR-10)", () => {
    // The count is for the latest version only, so feedback on version 1 is not counted for version 2.
    const row = progressRow(milestone, latest(0, 2, true), after, null);
    expect(row.latest).toEqual({ version: 2, late: true, submittedAt: before });
    expect(row.latest).not.toHaveProperty("feedbackCount");
    expect(row.feedbackStatus).toBe("AWAITING");
  });

  it("TEST-11.2u reuses the F-08/F-09 window and team status functions", () => {
    const late = { ...milestone, lateUntil: new Date(D.getTime() + 3600_000) };
    const closed = { ...milestone, closedAt: before };
    for (const [m, l, now] of [[milestone, null, after], [late, latest(0, 1, true), after], [closed, latest(1), after], [milestone, latest(0), before]] as const) {
      const row = progressRow(m, l, now, null);
      expect(row.window).toBe(submissionWindow(m, now));
      expect(row.teamStatus).toBe(teamStatus(m.dueAt, l, now));
    }
  });

  it("TEST-11.3u gives {released: false} with no score key until F-10 releases the grade", () => {
    for (const grade of [null, { draftScore: 90, releasedScore: null }]) {
      const row = progressRow(milestone, latest(1), before, grade);
      expect(row.grade).toEqual({ released: false });
      expect(row.grade).not.toHaveProperty("score");
      expect(JSON.stringify(row)).not.toMatch(/"score"|"draftScore"|90/); // the draft never reaches the row
    }
  });

  it("TEST-11.3u gives {released: true, score} from the released snapshot, not the newer draft", () => {
    expect(progressRow(milestone, latest(1), after, { draftScore: 85, releasedScore: 85 }).grade).toEqual({ released: true, score: 85 });
    expect(progressRow(milestone, latest(1), after, { draftScore: 92, releasedScore: 85 }).grade).toEqual({ released: true, score: 85 });
    expect(progressRow(milestone, latest(1), after, { draftScore: 0, releasedScore: 0 }).grade).toEqual({ released: true, score: 0 });
  });
});
