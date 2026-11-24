import { Prisma } from "@prisma/client";
import { HttpError } from "../errors.js";
import { milestoneClosed } from "../milestones/service.js";
import { submissionWindow } from "../milestones/status.js";
import { prisma } from "../prisma.js";

// F-05 insert, called after the route's F-02 guards and body validation.
export const withSubmitter = { submitter: { select: { id: true, name: true } } } as const;
export type SubmissionRow = Prisma.SubmissionGetPayload<{ include: typeof withSubmitter }>;
export type SubmissionInput = { title: string; description: string; link: string };

const alreadySubmitted = () => new HttpError(409, "ALREADY_SUBMITTED", "Your team has already submitted work for this milestone.");

export async function createSubmission(milestoneId: number, input: SubmissionInput, userId: number, now: Date): Promise<SubmissionRow> {
  const milestone = await prisma().milestone.findUniqueOrThrow({ where: { id: milestoneId } });
  // Duplicate first: a team that already submitted gets that message after the deadline too.
  if (await prisma().submission.count({ where: { milestoneId } })) throw alreadySubmitted();
  if (milestone.closedAt) throw milestoneClosed(); // BR-11, regardless of the deadline
  // F-09 adds acceptance in the Late window (FR-17); until then only OPEN accepts work.
  if (submissionWindow(milestone, now) !== "OPEN") {
    throw new HttpError(409, "DEADLINE_PASSED", "The deadline for this milestone has passed.");
  }
  try {
    return await prisma().submission.create({
      data: { ...input, milestoneId, version: 1, submittedBy: userId, submittedAt: now },
      include: withSubmitter,
    });
  } catch (error) {
    // A teammate's simultaneous request won the UNIQUE (milestone_id, version) race.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw alreadySubmitted();
    throw error;
  }
}
