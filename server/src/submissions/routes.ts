import { Router } from "express";
import { Prisma, type Milestone } from "@prisma/client";
import { assertTeamAccess, parseId, requireRole } from "../auth/authorize.js";
import { requireAuth } from "../auth/middleware.js";
import { HttpError, asyncHandler, notFoundError } from "../errors.js";
import { jsonBody } from "../json-body.js";
import { presentMilestone } from "../milestones/routes.js";
import { submissionWindow } from "../milestones/status.js";
import { prisma } from "../prisma.js";
import { parseSubmission } from "./validate.js";

// F-05: mounted at /api/milestones/:milestoneId. Guard order 401 → 403 → 404 → 400 → 409 (F-02).
export const submissionsRouter = Router({ mergeParams: true });

const withSubmitter = { submitter: { select: { id: true, name: true } } } as const;
type SubmissionRow = Prisma.SubmissionGetPayload<{ include: typeof withSubmitter }>;

function presentSubmission(row: SubmissionRow) {
  const { id, milestoneId, version, title, description, link, submittedAt, submitter } = row;
  return { id, milestoneId, version, title, description, link, submittedAt, submittedBy: submitter };
}

const alreadySubmitted = () => new HttpError(409, "ALREADY_SUBMITTED", "Your team has already submitted work for this milestone.");

/** Loads the milestone the caller may see; missing, malformed and other teams' IDs are one 404 (DEC-10). */
const requireMilestoneAccess = asyncHandler(async (req, res, next) => {
  const id = parseId(req.params.milestoneId);
  if (id === null) throw notFoundError();
  const milestone = await prisma().milestone.findUnique({ where: { id } });
  if (!milestone) throw notFoundError();
  await assertTeamAccess(req.user!, milestone.teamId);
  res.locals.milestone = milestone;
  next();
});

// Sprint 1 has one submission per milestone (version 1); Sprint 2 (F-09) adds versions.
function latestSubmission(milestoneId: number) {
  return prisma().submission.findFirst({ where: { milestoneId }, orderBy: { version: "desc" }, include: withSubmitter });
}

submissionsRouter.post("/submissions", requireAuth, requireRole("STUDENT"), requireMilestoneAccess, jsonBody, asyncHandler(async (req, res) => {
  const milestone: Milestone = res.locals.milestone;
  const input = parseSubmission(req.body);
  // One server instant for the deadline check and the stored time; client times are ignored.
  const now: Date = req.app.locals.now();
  // Duplicate first: a team that already submitted gets that message after the deadline too.
  if (await prisma().submission.count({ where: { milestoneId: milestone.id } })) throw alreadySubmitted();
  if (submissionWindow(milestone.dueAt, now) === "CLOSED") {
    throw new HttpError(409, "DEADLINE_PASSED", "The deadline for this milestone has passed.");
  }
  try {
    const row = await prisma().submission.create({
      data: { ...input, milestoneId: milestone.id, version: 1, submittedBy: req.user!.id, submittedAt: now },
      include: withSubmitter,
    });
    res.status(201).json({ submission: presentSubmission(row) });
  } catch (error) {
    // A teammate's simultaneous request won the UNIQUE (milestone_id, version) race.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw alreadySubmitted();
    throw error;
  }
}));

submissionsRouter.get("/submission", requireAuth, requireMilestoneAccess, asyncHandler(async (req, res) => {
  const milestone: Milestone = res.locals.milestone;
  const row = await latestSubmission(milestone.id);
  res.json({
    milestone: presentMilestone(milestone, req.app.locals.now(), row !== null),
    submission: row ? presentSubmission(row) : null,
  });
}));
