import type { AuthUser } from "../auth/middleware.js";
import { teamScope } from "../auth/authorize.js";
import { PAGE_SIZE } from "../milestones/routes.js";
import { notFoundError } from "../errors.js";
import { prisma } from "../prisma.js";
import { progressRow } from "./rows.js";

// Per milestone: only the latest version, with the feedback count of that version (BR-10).
const withLatest = {
  submissions: {
    orderBy: { version: "desc" }, take: 1,
    select: { version: true, late: true, submittedAt: true, _count: { select: { feedback: true } } },
  },
} as const;

/**
 * F-11 board data for one page, read in one consistent snapshot. Called after the route's guards; the team,
 * the page and the count are all scoped to the caller again inside the snapshot, so access lost after the
 * guard (for example an F-07 removal) gives the same fixed 404 and never the team's name.
 */
export async function readProgress(user: AuthUser, teamId: number, page: number, now: Date) {
  const scope = teamScope(user);
  const where = { teamId, team: scope };
  const [team, milestones, total] = await prisma().$transaction([
    prisma().team.findFirst({ where: { id: teamId, ...scope }, select: { id: true, name: true } }),
    prisma().milestone.findMany({
      where, include: withLatest, orderBy: [{ dueAt: "asc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    }),
    prisma().milestone.count({ where }),
  ], { isolationLevel: "RepeatableRead" });
  if (!team) throw notFoundError();
  const rows = milestones.map((m) => {
    const latest = m.submissions[0];
    return progressRow(m, latest ? { ...latest, feedbackCount: latest._count.feedback } : null, now);
  });
  return { team, rows, page, pageSize: PAGE_SIZE, total };
}
