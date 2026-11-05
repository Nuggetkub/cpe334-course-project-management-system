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
function present(row: Milestone, now: Date) {
  return { ...row, window: submissionWindow(row.dueAt, now), teamStatus: teamStatus(row.dueAt, false, now) };
}

teamMilestonesRouter.post("/", requireAuth, requireRole("SUPERVISOR"), requireTeamAccess, jsonBody, asyncHandler(async (req, res) => {
  const now: Date = req.app.locals.now();
  const input = parseMilestone(req.body, now);
  const row = await prisma().milestone.create({ data: {
    ...input, teamId: req.team!.id, createdBy: req.user!.id, createdAt: now,
  } });
  res.status(201).json({ milestone: present(row, now) });
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
    prisma().milestone.findMany({ where, orderBy: [{ dueAt: "asc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma().milestone.count({ where }),
  ], { isolationLevel: "RepeatableRead" });
  res.json({ milestones: milestones.map((row) => present(row, now)), page, pageSize, total });
}));

milestonesRouter.get("/:milestoneId", requireAuth, asyncHandler(async (req, res) => {
  const id = parseId(req.params.milestoneId);
  if (id === null) throw notFoundError();
  const row = await prisma().milestone.findUnique({ where: { id } });
  if (!row) throw notFoundError();
  await assertTeamAccess(req.user!, row.teamId);
  res.json({ milestone: present(row, req.app.locals.now()) });
}));
