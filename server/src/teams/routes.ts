import { Router } from "express";
import { parseId, requireRole, requireTeamAccess, teamScope } from "../auth/authorize.js";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler, notFoundError } from "../errors.js";
import { prisma } from "../prisma.js";
import { jsonBody } from "../json-body.js";
import { addMember, createTeam, listCandidates, removeMember, teamSummary as summary } from "./service.js";
import { parseCandidateQuery, parseStudentId, parseTeamName } from "./validate.js";

export const teamsRouter = Router();
const supervisorOnly = [requireAuth, requireRole("SUPERVISOR")];

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

teamsRouter.get("/", ...supervisorOnly, asyncHandler(async (req, res) => {
  const teams = await prisma().team.findMany({
    where: teamScope(req.user!),
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: summary,
  });
  res.json({ teams });
}));

teamsRouter.post("/", ...supervisorOnly, jsonBody, asyncHandler(async (req, res) => {
  res.status(201).json({ team: await createTeam(req.user!.id, parseTeamName(req.body)) });
}));

teamsRouter.get("/:teamId", ...supervisorOnly, requireTeamAccess, asyncHandler(async (req, res) => {
  const team = await prisma().team.findUnique({
    where: { id: req.team!.id },
    select: { ...summary, members: { orderBy: { studentId: "asc" }, select: { student: { select: summary } } } },
  });
  if (!team) throw notFoundError();
  res.json({ team: { ...team, members: team.members.map(({ student }) => student) } });
}));

teamsRouter.get("/:teamId/member-candidates", ...supervisorOnly, requireTeamAccess, asyncHandler(async (req, res) => {
  const { q, page } = parseCandidateQuery(req.query);
  res.json(await listCandidates(q, page));
}));

teamsRouter.post("/:teamId/members", ...supervisorOnly, requireTeamAccess, jsonBody, asyncHandler(async (req, res) => {
  res.status(201).json({ member: await addMember(req.team!.id, parseStudentId(req.body)) });
}));

teamsRouter.delete("/:teamId/members/:studentId", ...supervisorOnly, requireTeamAccess, asyncHandler(async (req, res) => {
  const studentId = parseId(req.params.studentId);
  if (studentId === null) throw notFoundError();
  await removeMember(req.team!.id, studentId);
  res.status(204).end();
}));
