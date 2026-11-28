import { describe, expect, it } from "vitest";
import { P95_LIMIT_MS, p95NearestRank, summarize, verdict } from "../scripts/perf-nfr09-lib.js";

// NFR-09 contract v0.2 §1, AC-P.3.
describe("NFR-09 statistics", () => {
  it("TEST-P.3u p95 is the 48th of 50 sorted values, from unsorted input", () => {
    const values = Array.from({ length: 50 }, (_, i) => ((i * 17) % 50) + 1);
    const copy = [...values];
    expect(new Set(values).size).toBe(50);
    expect(summarize(values)).toEqual({ n: 50, min: 1, median: 25.5, p95: 48, max: 50 });
    expect(p95NearestRank(values)).toBe(48);
    expect(values).toEqual(copy);
  });

  it("TEST-P.3u ties: the rank decides, not the distinct values", () => {
    const run = (fast: number, slow: number) => [...Array(slow).fill(600), ...Array(fast).fill(10)];
    expect(p95NearestRank(run(48, 2))).toBe(10);
    expect(p95NearestRank(run(47, 3))).toBe(600);
    expect(p95NearestRank(Array(50).fill(120))).toBe(120);
    expect(p95NearestRank([5])).toBe(5);
    expect(p95NearestRank(Array.from({ length: 20 }, (_, i) => 20 - i))).toBe(19);
  });

  it("TEST-P.3u the PASS/FAIL boundary is p95 < 500 ms", () => {
    expect(P95_LIMIT_MS).toBe(500);
    expect(verdict(499)).toBe("PASS");
    expect(verdict(499.9)).toBe("PASS");
    expect(verdict(500)).toBe("FAIL");
    expect(verdict(501)).toBe("FAIL");
  });

  it("TEST-P.3u refuses an empty sample", () => {
    expect(() => summarize([])).toThrow();
    expect(() => p95NearestRank([])).toThrow();
  });
});
