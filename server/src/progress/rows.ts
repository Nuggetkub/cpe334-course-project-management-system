import { submissionWindow, teamStatus, type TeamStatus, type Window } from "../milestones/status.js";

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

// The window and team status come from the same F-08/F-09 functions as the milestone page (DEC-13).
export function progressRow(milestone: ProgressMilestone, latest: ProgressLatest | null, now: Date): ProgressRow {
  return {
    milestoneId: milestone.id,
    title: milestone.title,
    dueAt: milestone.dueAt,
    window: submissionWindow(milestone, now),
    teamStatus: teamStatus(milestone.dueAt, latest, now),
    latest: latest && { version: latest.version, late: latest.late, submittedAt: latest.submittedAt },
    feedbackStatus: !latest ? "NONE" : latest.feedbackCount > 0 ? "RECEIVED" : "AWAITING",
  };
}
