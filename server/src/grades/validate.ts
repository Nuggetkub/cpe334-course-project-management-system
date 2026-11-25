import { HttpError } from "../errors.js";

export function parseGrade(body: unknown): { score: number } {
  const score = body !== null && typeof body === "object" && Object.hasOwn(body, "score")
    ? (body as { score: unknown }).score : undefined;
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 100) {
    throw new HttpError(400, "VALIDATION_ERROR", "Check the highlighted fields.", { score: "Enter a whole number from 0 to 100." });
  }
  return { score };
}
