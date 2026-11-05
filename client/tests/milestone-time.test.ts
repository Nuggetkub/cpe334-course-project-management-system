import { expect, it } from "vitest";
import { bangkokInputToIso, formatBangkok } from "../src/time";

it("TEST-04.3c formats UTC explicitly in Bangkok including a date rollover", () => {
  expect(formatBangkok("2026-11-08T16:59:00Z")).toBe("8 Nov 2026, 23:59 (ICT)");
  expect(formatBangkok("2026-11-08T17:00:00Z")).toBe("9 Nov 2026, 00:00 (ICT)");
});
it("TEST-04.3c interprets datetime-local as Bangkok regardless of the browser zone", () => {
  expect(bangkokInputToIso("2026-11-08T23:59")).toBe("2026-11-08T16:59:00.000Z");
  expect(bangkokInputToIso("2026-11-09T00:00")).toBe("2026-11-08T17:00:00.000Z");
});
it.each(["", "2026-11-31T12:00", "2027-02-29T12:00", "2026-11-08T24:00", "2026-11-08", "0000-01-01T00:00"])(
  "TEST-04.2c rejects ambiguous or impossible local date %s", (input) => expect(bangkokInputToIso(input)).toBeNull(),
);
