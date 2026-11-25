import { describe, expect, it } from "vitest";
import { parseCandidateQuery, parseStudentId, parseTeamName } from "../src/teams/validate.js";

const invalid = (field: string) => ({ status: 400, code: "VALIDATION_ERROR", fields: { [field]: expect.any(String) } });

describe("TEST-07.1u parses only supported team management inputs", () => {
  it("normalizes the name and counts Unicode code points, not UTF-16 code units", () => {
    expect(parseTeamName({ name: " A ", courseId: 1 })).toBe("A");
    expect(parseTeamName({ name: ` ${"📚".repeat(120)} ` })).toBe("📚".repeat(120));
    for (const name of [" ", "📚".repeat(121), "a\u0000b", "a\uD800b", 42, undefined]) {
      expect(() => parseTeamName({ name, courseId: 1 })).toThrow(expect.objectContaining(invalid("name")));
    }
  });

  it("accepts only a positive int4 JSON number as studentId", () => {
    expect(parseStudentId({ studentId: 2_147_483_647, teamId: 7 })).toBe(2_147_483_647);
    for (const studentId of [0, 2_147_483_648, 1.5, "42", undefined]) {
      expect(() => parseStudentId({ studentId, teamId: 7 })).toThrow(expect.objectContaining(invalid("studentId")));
    }
  });

  it("defaults candidate paging and rejects repeated or out-of-range filters", () => {
    expect(parseCandidateQuery({})).toEqual({ q: "", page: 1 });
    expect(parseCandidateQuery({ q: " Name ", page: "2" })).toEqual({ q: "Name", page: 2 });
    expect(() => parseCandidateQuery({ q: ["one", "two"] })).toThrow(expect.objectContaining(invalid("q")));
    for (const page of ["0", "01", "2147483648", ["2", "3"]]) {
      expect(() => parseCandidateQuery({ page })).toThrow(expect.objectContaining(invalid("page")));
    }
  });
});
