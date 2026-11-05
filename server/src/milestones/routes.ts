import { Router } from "express";
import type { Milestone } from "@prisma/client";
import { assertTeamAccess, parseId, requireRole, requireTeamAccess, teamScope } from "../auth/authorize.js";
import { requireAuth } from "../auth/middleware.js";
import { HttpError, asyncHandler, notFoundError } from "../errors.js";
import { jsonBody } from "../json-body.js";
import { prisma } from "../prisma.js";
import { submissionWindow, teamStatus } from "./status.js";
import { parseMilestone } from "./validate.js";

export const teamMilestonesRouter = Router({ mergeParams: true });
export const milestonesRouter = Router();
// Listed fields only, so a column added later is never returned by accident. F-05 supplies
// whether the milestone has a submission, which makes the team status Submitted.
export function presentMilestone(row: Milestone, now: Date, hasSubmission: boolean) {
  const { id, teamId, title, description, dueAt, createdBy, createdAt } = row;
  return {
    id, teamId, title, description, dueAt, createdBy, createdAt,
    window: submissionWindow(dueAt, now), teamStatus: teamStatus(dueAt, hasSubmission, now),
  };
}
const withSubmissionCount = { _count: { select: { submissions: true } } } as const;

teamMilestonesRouter.post("/", requireAuth, requireRole("SUPERVISOR"), requireTeamAccess, jsonBody, asyncHandler(async (req, res) => {
  const now: Date = req.app.locals.now();
  const input = parseMilestone(req.body, now);
  const row = await prisma().milestone.create({ data: {
    ...input, teamId: req.team!.id, createdBy: req.user!.id, createdAt: now,
  } });
  res.status(201).json({ milestone: presentMilestone(row, now, false) });
}));

teamMilestonesRouter.get("/", requireAuth, requireTeamAccess, asyncHandler(async (req, res) => {
  const raw = req.query.page;
  const page = raw === undefined ? 1 : parseId(raw);
  if (page === null || page > 42949673) throw new HttpError(400, "VALIDATION_ERROR", "Check the highlighted fields", { page: "Enter a positive page number within range." });
  const pageSize = 50;
  const now: Date = req.app.locals.now();
  const where = { teamId: req.team!.id, team: teamScope(req.user!) };
  // One database transaction for a consistent page and count; no other team's rows loaded.
  const [milestones, total] = await prisma().$transaction([
    prisma().milestone.findMany({ where, include: withSubmissionCount, orderBy: [{ dueAt: "asc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma().milestone.count({ where }),
  ], { isolationLevel: "RepeatableRead" });
  res.json({ milestones: milestones.map((row) => presentMilestone(row, now, row._count.submissions > 0)), page, pageSize, total });
}));

milestonesRouter.get("/:milestoneId", requireAuth, asyncHandler(async (req, res) => {
  const id = parseId(req.params.milestoneId);
  if (id === null) throw notFoundError();
  const row = await prisma().milestone.findUnique({ where: { id }, include: withSubmissionCount });
  if (!row) throw notFoundError();
  await assertTeamAccess(req.user!, row.teamId);
  res.json({ milestone: presentMilestone(row, req.app.locals.now(), row._count.submissions > 0) });
}));
