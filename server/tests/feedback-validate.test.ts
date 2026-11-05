import { describe, expect, it } from "vitest";
import { HttpError } from "../src/errors.js";
import { parseFeedback } from "../src/feedback/validate.js";

const MESSAGE = "Enter feedback (1–2000 characters).";

function fieldsOf(body: unknown): Record<string, string> {
  try {
    parseFeedback(body);
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    return (error as HttpError).fields ?? {};
  }
  throw new Error("expected a validation error");
}

describe("TEST-06.2a parseFeedback", () => {
  it("TEST-06.2a trims valid text and drops unknown fields", () => {
    expect(parseFeedback({ text: "  x  ", supervisorId: 9, createdAt: "2000-01-01T00:00:00Z" })).toEqual({ text: "x" });
    expect(parseFeedback({ text: "y" })).toEqual({ text: "y" });
    expect(parseFeedback({ text: "x".repeat(2000) }).text).toHaveLength(2000);
    expect([...parseFeedback({ text: "😀".repeat(2000) }).text]).toHaveLength(2000);
  });

  it.each([{ text: "" }, { text: "   " }, { text: "x".repeat(2001) }, { text: "😀".repeat(2001) }, { text: 5 }, {}, null, [], "text"])(
    "TEST-06.2a rejects %j on text",
    (body) => {
      expect(fieldsOf(body)).toEqual({ text: MESSAGE });
    },
  );
});
