import { describe, expect, it } from "vitest";
import { studentGrade } from "../src/grades/projection.js";
import { parseGrade } from "../src/grades/validate.js";

describe("F-10 grade validation and publication", () => {
  it("TEST-10.1u accepts numeric integer bounds and ignores untrusted fields", () => {
    expect(parseGrade({ score: 0, releasedBy: 13, teamId: 17 })).toEqual({ score: 0 });
    expect(parseGrade({ score: 100 })).toEqual({ score: 100 });
    for (const body of [{ score: -1 }, { score: 101 }, { score: 0.5 }, { score: "82" }, { score: null }, {}, null, [0]]) {
      expect(() => parseGrade(body)).toThrow(expect.objectContaining({
        status: 400, code: "VALIDATION_ERROR", fields: { score: expect.any(String) },
      }));
    }
  });

  it("TEST-10.1u projects only the published snapshot, including zero", () => {
    const draft = { releasedScore: null, draftScore: 82, releasedAt: null, releasedBy: null };
    expect(studentGrade(null)).toEqual({ released: false });
    expect(studentGrade(draft)).toEqual({ released: false });
    expect(studentGrade({ ...draft, releasedScore: 0 })).toEqual({ released: true, score: 0 });
    expect(studentGrade({ ...draft, releasedScore: 70 })).toEqual({ released: true, score: 70 });
  });
});
