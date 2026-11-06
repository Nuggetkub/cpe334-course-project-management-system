import { HttpError } from "../errors.js";

// Explicit timezone and calendar validation: Date.parse alone rolls e.g. Nov 31
// into December. Reject ambiguous local timestamps instead of using host TZ.
export function parseDueAt(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, , zone] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > days[m - 1] || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  if (zone !== "Z") {
    const zh = Number(zone.slice(1, 3)), zm = Number(zone.slice(4, 6));
    if (zh > 14 || zm > 59 || (zh === 14 && zm !== 0)) return null;
  }
  const result = new Date(value);
  return Number.isFinite(result.getTime()) && result.getUTCFullYear() >= 1 && result.getUTCFullYear() <= 9999 ? result : null;
}

export function parseMilestone(body: unknown, now: Date): { title: string; description: string; dueAt: Date } {
  const input = body !== null && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = input.description === undefined ? "" : typeof input.description === "string" ? input.description.trim() : null;
  const dueAt = parseDueAt(input.dueAt);
  const fields: Record<string, string> = {};
  if (!title || [...title].length > 120) fields.title = "Enter a title (1–120 characters).";
  if (description === null || [...description].length > 2000) fields.description = "Description must be at most 2000 characters.";
  if (!dueAt || dueAt.getTime() <= now.getTime()) fields.dueAt = "Enter a valid future due date and time.";
  if (Object.keys(fields).length) throw new HttpError(400, "VALIDATION_ERROR", "Check the highlighted fields", fields);
  return { title, description: description!, dueAt: dueAt! };
}
