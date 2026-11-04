import { describe, expect, it } from "vitest";
import { parseId } from "../src/auth/authorize.js";

describe("parseId (AC-02.5)", () => {
  it("TEST-02.5a accepts only canonical int4 positive integers", () => {
    expect(parseId("1")).toBe(1);
    expect(parseId("2147483647")).toBe(2147483647);

    for (const raw of ["0", "-1", "1.5", "01", "1e3", "abc", "", " 1", "2147483648", undefined]) {
      expect(parseId(raw), JSON.stringify(raw)).toBeNull();
    }
  });
});
