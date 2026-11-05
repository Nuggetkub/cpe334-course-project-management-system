import { HttpError } from "../errors.js";

// F-05 contract §1.4 (BR-09). Lengths count Unicode code points, as PostgreSQL varchar does.
const MESSAGES = {
  title: "Enter a title (1–120 characters).",
  description: "Description must be at most 2000 characters.",
  link: "Enter a full link starting with http:// or https://.",
};

const length = (value: string) => [...value].length;

/** Absolute http(s) URL with a host. Reachability is not checked (AS-03). */
function isWebLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}

/** Unknown fields (version, submittedBy, submittedAt, teamId) are dropped: the server sets them. */
export function parseSubmission(body: unknown): { title: string; description: string; link: string } {
  const input = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const title = typeof input.title === "string" ? input.title.trim() : null;
  const description = input.description === undefined ? "" : typeof input.description === "string" ? input.description.trim() : null;
  const link = typeof input.link === "string" ? input.link.trim() : null;

  const fields: Record<string, string> = {};
  if (title === null || length(title) < 1 || length(title) > 120) fields.title = MESSAGES.title;
  if (description === null || length(description) > 2000) fields.description = MESSAGES.description;
  if (link === null || length(link) > 2048 || !isWebLink(link)) fields.link = MESSAGES.link;
  if (Object.keys(fields).length) throw new HttpError(400, "VALIDATION_ERROR", "Check the highlighted fields", fields);
  return { title: title!, description: description!, link: link! };
}
