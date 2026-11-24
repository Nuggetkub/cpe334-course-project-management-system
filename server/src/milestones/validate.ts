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

// CR-01 (#73), BR-05: a new milestone's due date must be at least 24 h after
// server now (inclusive: exactly now + 24 h is accepted). Server clock only.
export const MIN_DUE_NOTICE_MS = 24 * 60 * 60 * 1000;
export const DUE_AT_MESSAGE = "Enter a due date at least 24 hours from now.";

export function parseMilestone(body: unknown, now: Date): { title: string; description: string; dueAt: Date } {
  const input = body !== null && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = input.description === undefined ? "" : typeof input.description === "string" ? input.description.trim() : null;
  const dueAt = parseDueAt(input.dueAt);
  const fields: Record<string, string> = {};
  if (!title || [...title].length > 120) fields.title = "Enter a title (1–120 characters).";
  if (description === null || [...description].length > 2000) fields.description = "Description must be at most 2000 characters.";
  if (!dueAt || dueAt.getTime() < now.getTime() + MIN_DUE_NOTICE_MS) fields.dueAt = DUE_AT_MESSAGE;
  if (Object.keys(fields).length) throw new HttpError(400, "VALIDATION_ERROR", "Check the highlighted fields", fields);
  return { title, description: description!, dueAt: dueAt! };
}

// F-08 (#81): PATCH body after validation. `lateUntil: null` removes the late window.
export interface MilestoneUpdate { title?: string; description?: string; dueAt?: Date; lateUntil?: Date | null }
export interface MilestoneDates { dueAt: Date; lateUntil: Date | null }

// Interface only until the F-08 tests are committed (test-first); the rules are in the F-08 contract §1.
export function parseMilestoneUpdate(_body: unknown, _current: MilestoneDates, _now: Date): MilestoneUpdate {
  throw new HttpError(501, "NOT_IMPLEMENTED", "Milestone updates are not implemented yet.");
}
