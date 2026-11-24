// The fields the window rule reads. F-08 passes the whole milestone (late window, close).
export interface WindowFields { dueAt: Date; lateUntil?: Date | null; closedAt?: Date | null }

// Shared with F-05: one inclusive server-time deadline rule.
export function submissionWindow(milestone: WindowFields, now: Date): "OPEN" | "CLOSED" {
  return now.getTime() <= milestone.dueAt.getTime() ? "OPEN" : "CLOSED";
}

// SRS §4.3.1 Sprint 1 rows: a submission makes the team Submitted, before and after the deadline (F-05).
// Team status depends on the deadline only, never on the window (DEC-13).
export type TeamStatus = "SUBMITTED" | "NOT_SUBMITTED" | "OVERDUE";
export function teamStatus(dueAt: Date, hasSubmission: boolean, now: Date): TeamStatus {
  if (hasSubmission) return "SUBMITTED";
  return now.getTime() <= dueAt.getTime() ? "NOT_SUBMITTED" : "OVERDUE";
}
