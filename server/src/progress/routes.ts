import { Router } from "express";
import { requireTeamAccess, teamScope } from "../auth/authorize.js";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../errors.js";
import { PAGE_SIZE, parsePage } from "../milestones/routes.js";
import { prisma } from "../prisma.js";
import { progressRow } from "./rows.js";

// F-11: mounted at /api/teams/:teamId/progress. Guards 401 → 404 (fixed F-02 body) → 400 page, read only.
export const progressRouter = Router({ mergeParams: true });

// Per milestone: only the latest version, with the feedback count of that version (BR-10).
const withLatest = {
  submissions: {
    orderBy: { version: "desc" }, take: 1,
    select: { version: true, late: true, submittedAt: true, _count: { select: { feedback: true } } },
  },
} as const;

progressRouter.get("/", requireAuth, requireTeamAccess, asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const now: Date = req.app.locals.now();
  const where = { teamId: req.team!.id, team: teamScope(req.user!) };
  // One consistent snapshot: the team, one page of milestones with their latest version, and the count.
  const [team, milestones, total] = await prisma().$transaction([
    prisma().team.findUniqueOrThrow({ where: { id: req.team!.id }, select: { id: true, name: true } }),
    prisma().milestone.findMany({
      where, include: withLatest, orderBy: [{ dueAt: "asc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    }),
    prisma().milestone.count({ where }),
  ], { isolationLevel: "RepeatableRead" });
  const rows = milestones.map((m) => {
    const latest = m.submissions[0];
    return progressRow(m, latest ? { ...latest, feedbackCount: latest._count.feedback } : null, now);
  });
  res.json({ team, rows, page, pageSize: PAGE_SIZE, total });
}));
