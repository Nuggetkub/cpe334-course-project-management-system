import type { AuthUser } from "../auth/middleware.js";
import { teamScope } from "../auth/authorize.js";
import { PAGE_SIZE, parsePage } from "../milestones/routes.js";
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
 * F-11 board data for one page, read in one RepeatableRead snapshot after the route's guards. Inside it:
 * the team is read with the caller's scope (none → fixed 404, so access lost after the guard, for example an
 * F-07 removal, never returns the team's name); only then is the raw `?page=` value validated (400
 * `fields.page`), so 401 → 404 → 400 holds here too; then the page of milestones and the count.
 */
export async function readProgress(user: AuthUser, teamId: number, rawPage: unknown, now: Date) {
  const scope = teamScope(user);
  const where = { teamId, team: scope };
  const { team, page, milestones, total } = await prisma().$transaction(async (tx) => {
    const team = await tx.team.findFirst({ where: { id: teamId, ...scope }, select: { id: true, name: true } });
    if (!team) throw notFoundError();
    const page = parsePage(rawPage);
    const milestones = await tx.milestone.findMany({
      where, include: withLatest, orderBy: [{ dueAt: "asc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    });
    const total = await tx.milestone.count({ where });
    return { team, page, milestones, total };
  }, { isolationLevel: "RepeatableRead" });
  const rows = milestones.map((m) => {
    const latest = m.submissions[0];
    return progressRow(m, latest ? { ...latest, feedbackCount: latest._count.feedback } : null, now);
  });
  return { team, rows, page, pageSize: PAGE_SIZE, total };
}
