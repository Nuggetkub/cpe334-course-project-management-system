// Shared with F-05: one inclusive server-time deadline rule.
export function submissionWindow(dueAt: Date, now: Date): "OPEN" | "CLOSED" {
  return now.getTime() <= dueAt.getTime() ? "OPEN" : "CLOSED";
}

// F-05 extends this with SUBMITTED and supplies actual submission existence.
export function teamStatus(dueAt: Date, _hasSubmission: false, now: Date): "NOT_SUBMITTED" | "OVERDUE" {
  return submissionWindow(dueAt, now) === "OPEN" ? "NOT_SUBMITTED" : "OVERDUE";
}
