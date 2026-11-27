import { teamStatus } from "../milestones/status.js";

// F-12 contract v0.2 §1 "Row states". The submission state is the F-09 team status under another name
// (DEC-13), so the overview, the F-11 board and the milestone page always agree.
export type SubmissionState = "LATE" | "SUBMITTED" | "MISSING" | "NOT_DUE";
export type FeedbackState = "NONE" | "AWAITING" | "RECEIVED";

const FROM_TEAM_STATUS = { LATE: "LATE", SUBMITTED: "SUBMITTED", OVERDUE: "MISSING", NOT_SUBMITTED: "NOT_DUE" } as const;

/** `latest` is the team's latest version (F-09), or null when nothing was submitted. */
export function submissionState(dueAt: Date, latest: { late: boolean } | null, now: Date): SubmissionState {
  return FROM_TEAM_STATUS[teamStatus(dueAt, latest, now)];
}

/** Feedback on the latest version only (BR-10). */
export function feedbackState(latest: { feedbackCount: number } | null): FeedbackState {
  if (!latest) return "NONE";
  return latest.feedbackCount > 0 ? "RECEIVED" : "AWAITING";
}
