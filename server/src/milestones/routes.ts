import { Router, type Request } from "express";
import type { Milestone } from "@prisma/client";
import { assertTeamAccess, parseId, requireRole, requireTeamAccess, teamScope } from "../auth/authorize.js";
import { requireAuth } from "../auth/middleware.js";
import { HttpError, asyncHandler, notFoundError } from "../errors.js";
import { jsonBody } from "../json-body.js";
import { prisma } from "../prisma.js";
import { submissionWindow, teamStatus } from "./status.js";
import { parseMilestone, parseMilestoneUpdate } from "./validate.js";

export const teamMilestonesRouter = Router({ mergeParams: true });
export const milestonesRouter = Router();
// Listed fields only, so a column added later is never returned by accident. F-05 supplies
// whether the milestone has a submission, which makes the team status Submitted.
export function presentMilestone(row: Milestone, now: Date, hasSubmission: boolean) {
  const { id, teamId, title, description, dueAt, createdBy, createdAt, lateUntil, closedAt, closedBy } = row;
  return {
    id, teamId, title, description, dueAt, createdBy, createdAt, lateUntil, closedAt, closedBy,
    window: submissionWindow(row, now), teamStatus: teamStatus(dueAt, hasSubmission, now),
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

// F-08: lifecycle changes. Guards 401 → 403 → 404 → 400, then 409 (F-02 order); denied requests write nothing.
export const milestoneClosed = () => new HttpError(409, "MILESTONE_CLOSED", "This milestone is closed.");

async function loadOwnMilestone(req: Request) {
  const id = parseId(req.params.milestoneId);
  if (id === null) throw notFoundError();
  const row = await prisma().milestone.findUnique({ where: { id }, include: withSubmissionCount });
  if (!row) throw notFoundError();
  await assertTeamAccess(req.user!, row.teamId);
  return row;
}

async function respondWith(res: import("express").Response, id: number, now: Date) {
  const saved = await prisma().milestone.findUniqueOrThrow({ where: { id }, include: withSubmissionCount });
  res.json({ milestone: presentMilestone(saved, now, saved._count.submissions > 0) });
}

// The ownership check runs before the JSON body is parsed, so a hidden milestone is 404 even with bad JSON.
const requireOwnMilestone = asyncHandler(async (req, _res, next) => { await loadOwnMilestone(req); next(); });

milestonesRouter.patch("/:milestoneId", requireAuth, requireRole("SUPERVISOR"), requireOwnMilestone, jsonBody, asyncHandler(async (req, res) => {
  const now: Date = req.app.locals.now();
  const row = await loadOwnMilestone(req);
  const update = parseMilestoneUpdate(req.body, row, now);
  const dateChange = update.dueAt !== undefined || update.lateUntil !== undefined;
  if (row.closedAt && dateChange) throw milestoneClosed();
  // Conditional write: a close that lands between the read and this update is never overwritten.
  const result = await prisma().milestone.updateMany({ where: { id: row.id, ...(dateChange ? { closedAt: null } : {}) }, data: update });
  if (result.count === 0) throw milestoneClosed();
  await respondWith(res, row.id, now);
}));

milestonesRouter.post("/:milestoneId/close", requireAuth, requireRole("SUPERVISOR"), requireOwnMilestone, jsonBody, asyncHandler(async (req, res) => {
  const now: Date = req.app.locals.now();
  const row = await loadOwnMilestone(req);
  const result = await prisma().milestone.updateMany({ where: { id: row.id, closedAt: null }, data: { closedAt: now, closedBy: req.user!.id } });
  if (result.count === 0) throw milestoneClosed();
  await respondWith(res, row.id, now);
}));
