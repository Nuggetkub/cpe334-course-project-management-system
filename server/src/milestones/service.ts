import type { Prisma } from "@prisma/client";
import { HttpError } from "../errors.js";
import { prisma } from "../prisma.js";
import { parseMilestoneUpdate } from "./validate.js";

// F-08 lifecycle writes, called after the route's F-02 guards (401 → 403 → 404 → 400).
// Contract v0.4 "Concurrency": every write locks the milestone row first and decides from that locked
// row, so two writes to one milestone are serialized and no check uses a stale read.
export const milestoneClosed = () => new HttpError(409, "MILESTONE_CLOSED", "This milestone is closed.");

/** Locks one milestone row for the rest of the transaction and returns its current values. */
export async function lockMilestone(tx: Prisma.TransactionClient, id: number) {
  await tx.$executeRaw`SELECT id FROM milestones WHERE id = ${id} FOR UPDATE`;
  return tx.milestone.findUniqueOrThrow({ where: { id } });
}

export async function updateMilestone(id: number, body: unknown, now: Date): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const row = await lockMilestone(tx, id);
    const update = parseMilestoneUpdate(body, row, now); // BR-12, BR-13 and CR-01 against the locked row
    if (row.closedAt && (update.dueAt !== undefined || update.lateUntil !== undefined)) throw milestoneClosed();
    await tx.milestone.update({ where: { id }, data: update });
  });
}

export async function closeMilestone(id: number, actorId: number, now: Date): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const row = await lockMilestone(tx, id);
    if (row.closedAt) throw milestoneClosed();
    await tx.milestone.update({ where: { id }, data: { closedAt: now, closedBy: actorId } });
  });
}
