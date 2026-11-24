import { Prisma } from "@prisma/client";
import { HttpError } from "../errors.js";
import { lockMilestone, milestoneClosed } from "../milestones/service.js";
import { submissionWindow } from "../milestones/status.js";
import { prisma } from "../prisma.js";
import { insertNextVersion } from "./versions.js";

// Submission insert, called after the route's F-02 guards and body validation.
export const withSubmitter = { submitter: { select: { id: true, name: true } } } as const;
export type SubmissionRow = Prisma.SubmissionGetPayload<{ include: typeof withSubmitter }>;
export type SubmissionInput = { title: string; description: string; link: string };

// F-09 (BR-08, FR-17, DEC-14) inside F-08 v0.4's locked transaction: each attempt locks the milestone
// row, then decides closed (BR-11) → deadline passed (BR-06) → version max + 1, Late in the Late
// window. insertNextVersion retries a (milestone_id, version) collision in a fresh transaction.
export async function createSubmission(milestoneId: number, input: SubmissionInput, userId: number, now: Date): Promise<SubmissionRow> {
  return insertNextVersion(() => prisma().$transaction(async (tx) => {
    const milestone = await lockMilestone(tx, milestoneId);
    if (milestone.closedAt) throw milestoneClosed();
    const window = submissionWindow(milestone, now);
    if (window === "CLOSED") throw new HttpError(409, "DEADLINE_PASSED", "The deadline for this milestone has passed.");
    const { _max } = await tx.submission.aggregate({ where: { milestoneId }, _max: { version: true } });
    return tx.submission.create({
      data: { ...input, milestoneId, version: (_max.version ?? 0) + 1, late: window === "LATE", submittedBy: userId, submittedAt: now },
      include: withSubmitter,
    });
  }));
}
