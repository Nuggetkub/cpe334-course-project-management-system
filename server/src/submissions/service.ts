import { Prisma } from "@prisma/client";
import { HttpError } from "../errors.js";
import { lockMilestone, milestoneClosed } from "../milestones/service.js";
import { submissionWindow } from "../milestones/status.js";
import { prisma } from "../prisma.js";

// F-05 insert, called after the route's F-02 guards and body validation.
export const withSubmitter = { submitter: { select: { id: true, name: true } } } as const;
export type SubmissionRow = Prisma.SubmissionGetPayload<{ include: typeof withSubmitter }>;
export type SubmissionInput = { title: string; description: string; link: string };

const alreadySubmitted = () => new HttpError(409, "ALREADY_SUBMITTED", "Your team has already submitted work for this milestone.");

// F-08 contract v0.4: one transaction that locks the milestone row, so a close committed first is
// always seen, and a close that starts later waits for this insert. Order: closed (BR-11) →
// duplicate (BR-07, until F-09) → window (BR-06).
export async function createSubmission(milestoneId: number, input: SubmissionInput, userId: number, now: Date): Promise<SubmissionRow> {
  try {
    return await prisma().$transaction(async (tx) => {
      const milestone = await lockMilestone(tx, milestoneId);
      if (milestone.closedAt) throw milestoneClosed();
      if (await tx.submission.count({ where: { milestoneId } })) throw alreadySubmitted();
      // F-09 adds acceptance in the Late window (FR-17); until then only OPEN accepts work.
      if (submissionWindow(milestone, now) !== "OPEN") {
        throw new HttpError(409, "DEADLINE_PASSED", "The deadline for this milestone has passed.");
      }
      return tx.submission.create({
        data: { ...input, milestoneId, version: 1, submittedBy: userId, submittedAt: now },
        include: withSubmitter,
      });
    });
  } catch (error) {
    // Kept as a backstop: the UNIQUE (milestone_id, version) constraint still guards version 1.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw alreadySubmitted();
    throw error;
  }
}
