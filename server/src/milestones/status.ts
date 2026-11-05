// Shared with F-05: one inclusive server-time deadline rule.
export function submissionWindow(dueAt: Date, now: Date): "OPEN" | "CLOSED" {
  return now.getTime() <= dueAt.getTime() ? "OPEN" : "CLOSED";
}

// SRS §4.3.1 Sprint 1 rows: a submission makes the team Submitted, before and after the deadline (F-05).
export type TeamStatus = "SUBMITTED" | "NOT_SUBMITTED" | "OVERDUE";
export function teamStatus(dueAt: Date, hasSubmission: boolean, now: Date): TeamStatus {
  if (hasSubmission) return "SUBMITTED";
  return submissionWindow(dueAt, now) === "OPEN" ? "NOT_SUBMITTED" : "OVERDUE";
}
