import { HttpError } from "../errors.js";

export function parseGrade(body: unknown): { score: number } {
  const score = body !== null && typeof body === "object" && Object.hasOwn(body, "score")
    ? (body as { score: unknown }).score : undefined;
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 100) {
    throw new HttpError(400, "VALIDATION_ERROR", "Check the highlighted fields.", { score: "Enter a whole number from 0 to 100." });
  }
  return { score };
}

/** F-10 v0.5: the draft score the Supervisor confirmed for release (400 `fields.expectedScore` otherwise). */
export function parseRelease(body: unknown): { expectedScore: number } {
  const value = body !== null && typeof body === "object" && Object.hasOwn(body, "expectedScore")
    ? (body as { expectedScore: unknown }).expectedScore : undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new HttpError(400, "VALIDATION_ERROR", "Check the highlighted fields.", { expectedScore: "Confirm the draft score to release (a whole number from 0 to 100)." });
  }
  return { expectedScore: value };
}
