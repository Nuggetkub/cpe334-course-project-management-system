import { Router } from "express";
import { Prisma, type Milestone } from "@prisma/client";
import { assertTeamAccess, parseId, requireRole } from "../auth/authorize.js";
import { requireAuth } from "../auth/middleware.js";
import { HttpError, asyncHandler, notFoundError } from "../errors.js";
import { jsonBody } from "../json-body.js";
import { presentMilestone } from "../milestones/routes.js";
import { submissionWindow } from "../milestones/status.js";
import { prisma } from "../prisma.js";
import { createSubmission, withSubmitter, type SubmissionRow } from "./service.js";
import { parseSubmission } from "./validate.js";

// F-05: mounted at /api/milestones/:milestoneId. Guard order 401 → 403 → 404 → 400 → 409 (F-02).
export const submissionsRouter = Router({ mergeParams: true });


function presentSubmission(row: SubmissionRow) {
  const { id, milestoneId, version, title, description, link, submittedAt, submitter } = row;
  return { id, milestoneId, version, title, description, link, submittedAt, submittedBy: submitter };
}


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
  const row = await createSubmission(milestone.id, input, req.user!.id, now);
  res.status(201).json({ submission: presentSubmission(row) });
}));

submissionsRouter.get("/submission", requireAuth, requireMilestoneAccess, asyncHandler(async (req, res) => {
  const milestone: Milestone = res.locals.milestone;
  const row = await latestSubmission(milestone.id);
  res.json({
    milestone: presentMilestone(milestone, req.app.locals.now(), row !== null),
    submission: row ? presentSubmission(row) : null,
  });
}));
