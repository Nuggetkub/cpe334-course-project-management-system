import { HttpError } from "../errors.js";
import { prisma } from "../prisma.js";
import { parseMilestoneUpdate } from "./validate.js";

// F-08 lifecycle writes, called after the route's F-02 guards (401 → 403 → 404 → 400).
export const milestoneClosed = () => new HttpError(409, "MILESTONE_CLOSED", "This milestone is closed.");

export async function updateMilestone(id: number, body: unknown, now: Date): Promise<void> {
  const row = await prisma().milestone.findUniqueOrThrow({ where: { id } });
  const update = parseMilestoneUpdate(body, row, now);
  const dateChange = update.dueAt !== undefined || update.lateUntil !== undefined;
  if (row.closedAt && dateChange) throw milestoneClosed();
  // Conditional write: a close that lands between the read and this update is never overwritten.
  const result = await prisma().milestone.updateMany({ where: { id, ...(dateChange ? { closedAt: null } : {}) }, data: update });
  if (result.count === 0) throw milestoneClosed();
}

export async function closeMilestone(id: number, actorId: number, now: Date): Promise<void> {
  const result = await prisma().milestone.updateMany({ where: { id, closedAt: null }, data: { closedAt: now, closedBy: actorId } });
  if (result.count === 0) throw milestoneClosed();
}
