import type { Prisma, Role } from "@prisma/client";
import type { RequestHandler } from "express";
import { HttpError, asyncHandler, notFoundError } from "../errors.js";
import { prisma } from "../prisma.js";
import { type AuthUser, UNAUTHENTICATED } from "./middleware.js";

// F-02 contract: checks run 401 (requireAuth) → 403 (requireRole) → 404 (ownership)
// → 400 (body validation). Ownership failures are indistinguishable from a missing
// record (DEC-10), so other teams' IDs are never confirmed.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireTeamAccess once the caller may act on this team. */
      team?: { id: number };
    }
  }
}

const MAX_INT4 = 2147483647;

/** BR-01: the role rule is public, so a wrong role is a plain 403. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw UNAUTHENTICATED();
    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, "FORBIDDEN", "You do not have permission to do this");
    }
    next();
  };
}

/** Canonical positive int4 only, so a bad ID is a 404 and never reaches Postgres. */
export function parseId(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^[1-9][0-9]*$/.test(raw)) return null;
  const id = Number(raw);
  return id <= MAX_INT4 ? id : null;
}

/** BR-02 / BR-03: the teams this user may see, as a query filter (never filter in memory). */
export function teamScope(user: AuthUser): Prisma.TeamWhereInput {
  // Each role is checked only against its own table, even if bad data puts it in the other.
  return user.role === "SUPERVISOR"
    ? { supervisors: { some: { supervisorId: user.id } } }
    : { members: { some: { studentId: user.id } } };
}

export async function canAccessTeam(user: AuthUser, teamId: number): Promise<boolean> {
  return (await prisma().team.count({ where: { id: teamId, ...teamScope(user) } })) === 1;
}

/** For nested records: load the record's team_id first (missing → same 404), then call this. */
export async function assertTeamAccess(user: AuthUser, teamId: number): Promise<void> {
  if (!(await canAccessTeam(user, teamId))) throw notFoundError();
}

/** For routes with `:teamId`; must run after requireAuth (and requireRole, if any). */
export const requireTeamAccess = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw UNAUTHENTICATED();
  const teamId = parseId(req.params.teamId);
  if (teamId === null) throw notFoundError();
  await assertTeamAccess(req.user, teamId);
  req.team = { id: teamId };
  next();
});
