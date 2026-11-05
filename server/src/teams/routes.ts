import { Router } from "express";
import { requireRole, teamScope } from "../auth/authorize.js";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler, notFoundError } from "../errors.js";
import { prisma } from "../prisma.js";

export const teamsRouter = Router();
const summary = { id: true, name: true } as const;

teamsRouter.get("/mine", requireAuth, requireRole("STUDENT"), asyncHandler(async (req, res) => {
  const team = await prisma().team.findFirst({
    where: teamScope(req.user!),
    select: {
      ...summary,
      members: { orderBy: { studentId: "asc" }, select: { student: { select: summary } } },
      supervisors: { orderBy: { supervisorId: "asc" }, select: { supervisor: { select: summary } } },
    },
  });
  if (!team) throw notFoundError();
  res.json({
    team: {
      id: team.id,
      name: team.name,
      members: team.members.map(({ student }) => student),
      supervisors: team.supervisors.map(({ supervisor }) => supervisor),
    },
  });
}));

teamsRouter.get("/", requireAuth, requireRole("SUPERVISOR"), asyncHandler(async (req, res) => {
  const teams = await prisma().team.findMany({
    where: teamScope(req.user!),
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: summary,
  });
  res.json({ teams });
}));
