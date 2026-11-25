import { parseId } from "../auth/authorize.js";
import { HttpError } from "../errors.js";

const maxInt4 = 2_147_483_647;
const maxName = 120;

function invalid(field: string, message: string): never {
  throw new HttpError(400, "VALIDATION_ERROR", "Check the highlighted fields.", { [field]: message });
}

function field(body: unknown, key: string): unknown {
  return body !== null && typeof body === "object" && Object.hasOwn(body, key)
    ? (body as Record<string, unknown>)[key] : undefined;
}

function validText(value: string, min: number): boolean {
  const chars = [...value];
  // PostgreSQL text cannot store NUL, and unpaired surrogates do not round-trip as UTF-8.
  return chars.length >= min && chars.length <= maxName && !/[\u0000\uD800-\uDFFF]/u.test(value);
}

export function parseTeamName(body: unknown): string {
  const raw = field(body, "name");
  const name = typeof raw === "string" ? raw.trim() : "";
  return validText(name, 1) ? name : invalid("name", "Enter a team name of 1 to 120 characters.");
}

export function parseStudentId(body: unknown): number {
  const id = field(body, "studentId");
  return typeof id === "number" && Number.isInteger(id) && id >= 1 && id <= maxInt4
    ? id : invalid("studentId", "Choose a student.");
}

export function parseCandidateQuery(query: { q?: unknown; page?: unknown }) {
  if (query.q !== undefined && typeof query.q !== "string") invalid("q", "Enter a search term of up to 120 characters.");
  const q = query.q?.trim() ?? "";
  if (!validText(q, 0)) invalid("q", "Enter a search term of up to 120 characters.");
  const page = query.page === undefined ? 1 : parseId(query.page);
  if (page === null) invalid("page", "Enter a positive page number.");
  return { q, page };
}
