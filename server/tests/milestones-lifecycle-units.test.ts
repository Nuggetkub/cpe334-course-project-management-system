import { describe, expect, it } from "vitest";
import { parseMilestoneUpdate } from "../src/milestones/validate.js";
import { submissionWindow, teamStatus } from "../src/milestones/status.js";

// F-08 contract §1 and §4. Fixed server clock; D is the current due date.
const now = new Date("2026-11-25T12:00:00Z");
const D = new Date("2026-11-28T12:00:00Z");
const current = { dueAt: D, lateUntil: null };
const MSG = {
  body: "Change at least one field.",
  extend: "The new due date must be later than the current one.",
  notice: "Enter a due date at least 24 hours from now.",
  lateAfterDue: "The late window must end after the due date.",
  lateFuture: "The late window must end in the future.",
  lateFormat: "Enter a valid late-window end.",
};
function rejects(body: unknown, fields: Record<string, string>, cur: { dueAt: Date; lateUntil: Date | null } = current) {
  expect(() => parseMilestoneUpdate(body, cur, now)).toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR", fields }));
}

describe("F-08 unit contract", () => {
  it("TEST-08.2u accepts and normalizes edits, extensions and late windows", () => {
    expect(parseMilestoneUpdate({ title: "  New  ", description: "  d  ", createdBy: 9, closedAt: "2000-01-01T00:00:00Z" }, current, now))
      .toEqual({ title: "New", description: "d" });
    expect(parseMilestoneUpdate({ description: "" }, current, now)).toEqual({ description: "" });
    expect(parseMilestoneUpdate({ dueAt: "2026-11-29T19:00:00+07:00" }, current, now)).toEqual({ dueAt: new Date("2026-11-29T12:00:00Z") });
    expect(parseMilestoneUpdate({ lateUntil: "2026-11-28T12:00:00.001Z" }, current, now)).toEqual({ lateUntil: new Date("2026-11-28T12:00:00.001Z") });
    expect(parseMilestoneUpdate({ lateUntil: null }, { dueAt: D, lateUntil: new Date("2026-11-29T00:00:00Z") }, now)).toEqual({ lateUntil: null });
    // dueAt and lateUntil together: lateUntil is checked against the new due date.
    expect(parseMilestoneUpdate({ dueAt: "2026-11-30T00:00:00Z", lateUntil: "2026-11-30T06:00:00Z" }, current, now))
      .toEqual({ dueAt: new Date("2026-11-30T00:00:00Z"), lateUntil: new Date("2026-11-30T06:00:00Z") });
  });

  it("TEST-08.2u accepts an extension to exactly now + 24 h when the current due date is earlier", () => {
    const soon = { dueAt: new Date("2026-11-25T13:00:00Z"), lateUntil: null };
    expect(parseMilestoneUpdate({ dueAt: "2026-11-26T12:00:00Z" }, soon, now)).toEqual({ dueAt: new Date("2026-11-26T12:00:00Z") });
  });

  it("TEST-08.2u rejects an empty or non-object body", () => {
    for (const body of [{}, null, [], "x", { unknown: 1 }]) rejects(body, { body: MSG.body });
  });

  it("TEST-08.2u rejects a due date that does not move later (BR-13)", () => {
    rejects({ dueAt: D.toISOString() }, { dueAt: MSG.extend });
    rejects({ dueAt: "2026-11-28T11:00:00Z" }, { dueAt: MSG.extend });
  });

  it("TEST-08.2u rejects an extension under the 24 h minimum notice (BR-05, CR-01)", () => {
    const soon = { dueAt: new Date("2026-11-25T13:00:00Z"), lateUntil: null };
    rejects({ dueAt: "2026-11-26T11:59:59Z" }, { dueAt: MSG.notice }, soon);
    rejects({ dueAt: "2026-11-26T11:59:59.999Z" }, { dueAt: MSG.notice }, soon);
  });

  it("TEST-08.2u rejects invalid fields together", () => {
    rejects({ title: " ", description: "x".repeat(2001), dueAt: "2026-11-31T00:00:00Z", lateUntil: "tomorrow" },
      { title: "Enter a title (1–120 characters).", description: "Description must be at most 2000 characters.", dueAt: MSG.notice, lateUntil: MSG.lateFormat });
  });

  it("TEST-08.2u rejects late windows that do not end after the due date or in the future (BR-12)", () => {
    rejects({ lateUntil: D.toISOString() }, { lateUntil: MSG.lateAfterDue });
    rejects({ lateUntil: "2026-11-27T00:00:00Z" }, { lateUntil: MSG.lateAfterDue });
    const passed = { dueAt: new Date("2026-11-20T00:00:00Z"), lateUntil: null };
    rejects({ lateUntil: now.toISOString() }, { lateUntil: MSG.lateFuture }, passed);
    // Extending the due date to or past an existing late window without moving the window.
    rejects({ dueAt: "2026-11-30T00:00:00Z" }, { lateUntil: MSG.lateAfterDue }, { dueAt: D, lateUntil: new Date("2026-11-29T00:00:00Z") });
    rejects({ dueAt: "2026-11-29T00:00:00Z" }, { lateUntil: MSG.lateAfterDue }, { dueAt: D, lateUntil: new Date("2026-11-29T00:00:00Z") });
  });

  it("TEST-08.5u evaluates the Sprint 2 window rows at their boundaries", () => {
    const L = new Date("2026-11-28T18:00:00Z");
    const at = (base: Date, ms: number) => new Date(base.getTime() + ms);
    const withLate = { dueAt: D, lateUntil: L, closedAt: null };
    expect([-1000, 0, 1].map((ms) => submissionWindow(withLate, at(D, ms)))).toEqual(["OPEN", "OPEN", "LATE"]);
    expect([0, 1].map((ms) => submissionWindow(withLate, at(L, ms)))).toEqual(["LATE", "CLOSED"]);
    expect(submissionWindow({ dueAt: D, lateUntil: null, closedAt: null }, at(D, 1))).toBe("CLOSED");
    const closed = { dueAt: D, lateUntil: L, closedAt: new Date("2026-11-26T00:00:00Z") };
    for (const t of [at(D, -1000), at(D, 1), at(L, 1)]) expect(submissionWindow(closed, t)).toBe("CLOSED");
  });

  it("TEST-08.5u keeps team status independent of closing (DEC-13)", () => {
    // teamStatus reads only the deadline and whether a submission exists, never closedAt.
    expect(teamStatus(D, false, new Date(D.getTime() - 1000))).toBe("NOT_SUBMITTED");
    expect(teamStatus(D, false, new Date(D.getTime() + 1))).toBe("OVERDUE");
    expect(teamStatus(D, true, new Date(D.getTime() + 1))).toBe("SUBMITTED");
  });
});
