import { HttpError } from "../errors.js";

// F-06 contract §1.4 (BR-10). Length counts Unicode code points, as PostgreSQL varchar does.
const MESSAGE = "Enter feedback (1–2000 characters).";

/** Unknown fields (supervisorId, createdAt, submissionId) are dropped: the server sets them. */
export function parseFeedback(body: unknown): { text: string } {
  const input = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const text = typeof input.text === "string" ? input.text.trim() : "";
  const length = [...text].length;
  if (length < 1 || length > 2000) throw new HttpError(400, "VALIDATION_ERROR", "Check the highlighted fields", { text: MESSAGE });
  return { text };
}
