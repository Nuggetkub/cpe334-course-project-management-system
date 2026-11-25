import type { Window, TeamStatus } from "../milestones/status.js";

// F-11 contract §1 "Row rules": one progress-board row per milestone, computed at one server instant.
export interface ProgressMilestone { id: number; title: string; dueAt: Date; lateUntil: Date | null; closedAt: Date | null }
/** The team's highest version and the number of feedback entries on that version only (BR-10). */
export interface ProgressLatest { version: number; late: boolean; submittedAt: Date; feedbackCount: number }
export type FeedbackStatus = "NONE" | "AWAITING" | "RECEIVED";

/** Phase 1 row: no `grade` key at all until F-11 is wired to F-10 (contract v0.3). */
export interface ProgressRow {
  milestoneId: number; title: string; dueAt: Date; window: Window; teamStatus: TeamStatus;
  latest: { version: number; late: boolean; submittedAt: Date } | null;
  feedbackStatus: FeedbackStatus;
}

export function progressRow(_milestone: ProgressMilestone, _latest: ProgressLatest | null, _now: Date): ProgressRow {
  throw new Error("F-11 progressRow is not implemented yet");
}
