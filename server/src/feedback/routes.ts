import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { assertTeamAccess, parseId, requireRole } from "../auth/authorize.js";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler, notFoundError } from "../errors.js";
import { jsonBody } from "../json-body.js";
import { prisma } from "../prisma.js";
import { parseFeedback } from "./validate.js";

// F-06: mounted at /api/submissions/:submissionId/feedback. Guard order 401 → 403 → 404 → 400 (F-02).
export const feedbackRouter = Router({ mergeParams: true });

const withAuthorAndVersion = {
  author: { select: { id: true, name: true } },
  submission: { select: { version: true } },
} as const;
type FeedbackRow = Prisma.FeedbackGetPayload<{ include: typeof withAuthorAndVersion }>;

function presentFeedback(row: FeedbackRow) {
  const { id, submissionId, text, createdAt, author, submission } = row;
  return { id, submissionId, version: submission.version, text, createdAt, author };
}

/** Resolves submission → milestone → team; missing, malformed and other teams' IDs are one 404 (DEC-10). */
const requireSubmissionAccess = asyncHandler(async (req, res, next) => {
  const id = parseId(req.params.submissionId);
  if (id === null) throw notFoundError();
  const submission = await prisma().submission.findUnique({ where: { id }, select: { id: true, milestone: { select: { teamId: true } } } });
  if (!submission) throw notFoundError();
  await assertTeamAccess(req.user!, submission.milestone.teamId);
  res.locals.submissionId = submission.id;
  next();
});

feedbackRouter.post("/", requireAuth, requireRole("SUPERVISOR"), requireSubmissionAccess, jsonBody, asyncHandler(async (req, res) => {
  const { text } = parseFeedback(req.body);
  const row = await prisma().feedback.create({
    data: { text, submissionId: res.locals.submissionId, supervisorId: req.user!.id, createdAt: req.app.locals.now() },
    include: withAuthorAndVersion,
  });
  res.status(201).json({ feedback: presentFeedback(row) });
}));

feedbackRouter.get("/", requireAuth, requireSubmissionAccess, asyncHandler(async (_req, res) => {
  const rows = await prisma().feedback.findMany({
    where: { submissionId: res.locals.submissionId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: withAuthorAndVersion,
  });
  res.json({ feedback: rows.map(presentFeedback) });
}));
