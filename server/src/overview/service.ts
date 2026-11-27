import type { AuthUser } from "../auth/middleware.js";
import { parseId, teamScope } from "../auth/authorize.js";
import { notFoundError } from "../errors.js";
import { PAGE_SIZE } from "../milestones/routes.js";
import { submissionWindow } from "../milestones/status.js";
import { prisma } from "../prisma.js";
import type { OverviewQuery } from "./filters.js";
import { feedbackState, submissionState } from "./states.js";

// Per milestone: its team, and only the latest version with that version's feedback count (BR-10).
const select = {
  id: true, title: true, dueAt: true, lateUntil: true, closedAt: true,
  team: { select: { id: true, name: true } },
  submissions: {
    orderBy: { version: "desc" }, take: 1,
    select: { version: true, late: true, _count: { select: { feedback: true } } },
  },
} as const;

/**
 * F-12 overview, read in one RepeatableRead snapshot. The `team` filter must be one of the caller's
 * supervised teams (unknown, malformed, repeated or another team's ID → fixed 404, DEC-10); then one query
 * scoped to those teams (BR-02). The states come from the shared functions, and filtering and paging are
 * applied to those states, so a row's state is computed in one place only.
 */
export async function readOverview(user: AuthUser, query: OverviewQuery, now: Date) {
  const scope = teamScope(user);
  const { teamId, milestones } = await prisma().$transaction(async (tx) => {
    let teamId: number | null = null;
    if (query.team !== undefined) {
      const id = parseId(query.team);
      const team = id === null ? null : await tx.team.findFirst({ where: { id, ...scope }, select: { id: true } });
      if (!team) throw notFoundError();
      teamId = team.id;
    }
    const milestones = await tx.milestone.findMany({
      where: { team: scope, ...(teamId === null ? {} : { teamId }) },
      select, orderBy: [{ team: { name: "asc" } }, { dueAt: "asc" }, { id: "asc" }],
    });
    return { teamId, milestones };
  }, { isolationLevel: "RepeatableRead" });

  const rows = milestones.map((m) => {
    const latest = m.submissions[0] ?? null;
    return {
      teamId: m.team.id, teamName: m.team.name, milestoneId: m.id, title: m.title, dueAt: m.dueAt,
      window: submissionWindow(m, now),
      submissionState: submissionState(m.dueAt, latest, now),
      feedbackState: feedbackState(latest && { feedbackCount: latest._count.feedback }),
      latestVersion: latest?.version ?? null,
    };
  });
  const wanted = new Set<string>(query.states);
  const matching = wanted.size === 0 ? rows : rows.filter((r) =>
    wanted.has(r.submissionState) || (wanted.has("AWAITING") && r.feedbackState === "AWAITING"));
  const start = (query.page - 1) * PAGE_SIZE;
  return {
    rows: matching.slice(start, start + PAGE_SIZE), page: query.page, pageSize: PAGE_SIZE, total: matching.length,
    filters: { team: teamId, state: query.states },
  };
}
