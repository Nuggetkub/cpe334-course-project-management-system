import { describe, expect, it } from "vitest";
import { parseMilestone } from "../src/milestones/validate.js";
import { submissionWindow, teamStatus } from "../src/milestones/status.js";

const now = new Date("2026-11-05T12:00:00Z");
const valid = { title: "  Prototype  ", dueAt: "2026-11-08T23:59:00+07:00" };

describe("F-04 unit contract", () => {
  it("TEST-04.2u trims values, defaults description, normalizes explicit offsets and drops forged fields", () => {
    expect(parseMilestone({ ...valid, createdBy: 99 }, now)).toEqual({
      title: "Prototype", description: "", dueAt: new Date("2026-11-08T16:59:00Z"),
    });
    expect(parseMilestone({ ...valid, title: "😀".repeat(120), description: "x".repeat(2000) }, now).title).toHaveLength(240);
  });

  it.each([
    null, [], { ...valid, title: " " }, { ...valid, title: "x".repeat(121) },
    { ...valid, title: 3 }, { ...valid, description: null }, { ...valid, description: "x".repeat(2001) },
    ...["", "2026-11-08", "2026-11-08T23:59:00", "2026-11-31T12:00:00Z", "2027-02-29T12:00:00Z",
      "2026-12-01T24:00:00Z", "2026-12-01T12:00:60Z", "2026-12-01T12:00:00+14:30",
      "2026-11-05T12:00:00Z", "2026-11-05T11:59:59Z", "0000-01-01T00:00:00Z"].map((dueAt) => ({ ...valid, dueAt })),
  ])("TEST-04.2u rejects invalid input %j", (input) => {
    expect(() => parseMilestone(input, now)).toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it.each([[-1000, "OPEN", "NOT_SUBMITTED"], [0, "OPEN", "NOT_SUBMITTED"], [1, "CLOSED", "OVERDUE"], [1000, "CLOSED", "OVERDUE"]] as const)(
    "TEST-04.4u evaluates the deadline at offset %s ms", (offset, window, status) => {
      const at = new Date(now.getTime() + offset);
      expect(submissionWindow(now, at)).toBe(window);
      expect(teamStatus(now, false, at)).toBe(status);
    },
  );
});
