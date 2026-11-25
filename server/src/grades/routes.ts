import { Router } from "express";
import { parseId, requireRole, teamScope } from "../auth/authorize.js";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler, notFoundError } from "../errors.js";
import { jsonBody } from "../json-body.js";
import { prisma } from "../prisma.js";
import { supervisorGrade } from "./projection.js";
import { readGrade, releaseGrade, saveGrade } from "./service.js";
import { parseGrade, parseRelease } from "./validate.js";

export const gradesRouter = Router({ mergeParams: true });
const supervisors = [requireAuth, requireRole("SUPERVISOR")];

function milestoneId(raw: unknown): number {
  const id = parseId(raw);
  if (id === null) throw notFoundError();
  return id;
}

// Authenticate, check role, then check scope before parsing the PUT body (F-02).
const requireGradeWriteScope = asyncHandler(async (req, res, next) => {
  const id = milestoneId(req.params.milestoneId);
  const scope = teamScope(req.user!);
  const milestone = await prisma().milestone.findFirst({ where: { id, team: scope }, select: { id: true } });
  if (!milestone) throw notFoundError();
  res.locals.gradeMilestoneId = milestone.id;
  next();
});

gradesRouter.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

gradesRouter.get("/", requireAuth, asyncHandler(async (req, res) => {
  res.json({ grade: await readGrade(milestoneId(req.params.milestoneId), req.user!) });
}));

gradesRouter.put("/", ...supervisors, requireGradeWriteScope, jsonBody, asyncHandler(async (req, res) => {
  const { score } = parseGrade(req.body);
  const row = await saveGrade(res.locals.gradeMilestoneId, req.user!.id, score, req.app.locals.now());
  res.json({ grade: supervisorGrade(row) });
}));

gradesRouter.post("/release", ...supervisors, requireGradeWriteScope, jsonBody, asyncHandler(async (req, res) => {
  const { expectedScore } = parseRelease(req.body);
  const row = await releaseGrade(res.locals.gradeMilestoneId, req.user!.id, expectedScore, req.app.locals.now());
  res.json({ grade: supervisorGrade(row) });
}));
