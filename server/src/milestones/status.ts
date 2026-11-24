// The fields the window rule reads. F-08 passes the whole milestone (late window, close).
export interface WindowFields { dueAt: Date; lateUntil?: Date | null; closedAt?: Date | null }

// SRS §4.3.1 window rows, first match wins (F-08): closed by a Supervisor → Open until the
// deadline inclusive → Late window until late_until inclusive → Closed. Server time only.
export type Window = "OPEN" | "LATE" | "CLOSED";
export function submissionWindow(milestone: WindowFields, now: Date): Window {
  if (milestone.closedAt) return "CLOSED";
  const t = now.getTime();
  if (t <= milestone.dueAt.getTime()) return "OPEN";
  if (milestone.lateUntil && t <= milestone.lateUntil.getTime()) return "LATE";
  return "CLOSED";
}

// SRS §4.3.1 Sprint 1 rows: a submission makes the team Submitted, before and after the deadline (F-05).
// Team status depends on the deadline only, never on the window (DEC-13).
export type TeamStatus = "SUBMITTED" | "NOT_SUBMITTED" | "OVERDUE";
/** `latest` is the team's latest version (F-09), or a plain "has a submission" flag (Sprint 1 callers). */
export type Latest = boolean | { late: boolean } | null;
export function teamStatus(dueAt: Date, latest: Latest, now: Date): TeamStatus {
  if (latest) return "SUBMITTED";
  return now.getTime() <= dueAt.getTime() ? "NOT_SUBMITTED" : "OVERDUE";
}
