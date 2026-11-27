import { HttpError } from "../errors.js";
import { parsePage } from "../milestones/routes.js";

// F-12 contract v0.2 §1: `state` is optional and repeatable (OR); AWAITING filters the feedback state.
export const STATE_FILTERS = ["LATE", "SUBMITTED", "MISSING", "NOT_DUE", "AWAITING"] as const;
export type StateFilter = (typeof STATE_FILTERS)[number];

export interface OverviewQuery { team: unknown; states: StateFilter[]; page: number }

/** The 400 checks (`state`, then `page`). The `team` value is checked later, inside the scoped snapshot. */
export function parseOverviewQuery(query: Record<string, unknown>): OverviewQuery {
  const raw = query.state === undefined ? [] : Array.isArray(query.state) ? query.state : [query.state];
  if (!raw.every((v): v is StateFilter => typeof v === "string" && (STATE_FILTERS as readonly string[]).includes(v))) {
    throw new HttpError(400, "VALIDATION_ERROR", "Check the highlighted fields", {
      state: `Use ${STATE_FILTERS.join(", ")}.`,
    });
  }
  const states = STATE_FILTERS.filter((s) => raw.includes(s));
  return { team: query.team, states, page: parsePage(query.page) };
}
