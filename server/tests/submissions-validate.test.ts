import { describe, expect, it } from "vitest";
import { HttpError } from "../src/errors.js";
import { parseSubmission } from "../src/submissions/validate.js";

const valid = { title: "Week 1", link: "https://a.b/c" };
const MESSAGES = {
  title: "Enter a title (1–120 characters).",
  description: "Description must be at most 2000 characters.",
  link: "Enter a full link starting with http:// or https://.",
};

function fieldsOf(body: unknown): Record<string, string> {
  try {
    parseSubmission(body);
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    return (error as HttpError).fields ?? {};
  }
  throw new Error("expected a validation error");
}

describe("TEST-05.2a parseSubmission", () => {
  it("TEST-05.2a accepts and normalizes valid input, dropping unknown fields", () => {
    expect(parseSubmission({ ...valid, title: "  x  ", submittedAt: "2000-01-01T00:00:00Z", version: 9 })).toEqual({
      title: "x", description: "", link: "https://a.b/c",
    });
    expect(parseSubmission({ title: "t".repeat(120), description: "d".repeat(2000), link: "http://a.b" })).toEqual({
      title: "t".repeat(120), description: "d".repeat(2000), link: "http://a.b",
    });
    expect(parseSubmission({ ...valid, link: ` https://a.b/${"x".repeat(2036)} ` }).link).toHaveLength(2048);
  });

  it.each([
    [{ ...valid, title: "" }, "title"],
    [{ ...valid, title: "   " }, "title"],
    [{ ...valid, title: "t".repeat(121) }, "title"],
    [{ ...valid, title: 7 }, "title"],
    [{ ...valid, description: "d".repeat(2001) }, "description"],
    [{ ...valid, description: null }, "description"],
    [{ ...valid, link: "example.com" }, "link"],
    [{ ...valid, link: "/work" }, "link"],
    [{ ...valid, link: "ftp://a.b" }, "link"],
    [{ ...valid, link: "javascript:alert(1)" }, "link"],
    [{ ...valid, link: "https://" }, "link"],
    [{ ...valid, link: `https://a.b/${"x".repeat(2037)}` }, "link"],
    [{ ...valid, link: 42 }, "link"],
  ])("TEST-05.2a rejects %j on %s with its message", (body, field) => {
    expect(fieldsOf(body)).toEqual({ [field]: MESSAGES[field as keyof typeof MESSAGES] });
  });

  it.each([null, [], "text"])("TEST-05.2a rejects a non-object body %j on title and link", (body) => {
    expect(fieldsOf(body)).toEqual({ title: MESSAGES.title, link: MESSAGES.link });
  });
});
