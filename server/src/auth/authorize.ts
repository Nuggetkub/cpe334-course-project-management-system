import type { Prisma, Role } from "@prisma/client";
import type { RequestHandler } from "express";
import { asyncHandler } from "../errors.js";
import type { AuthUser } from "./middleware.js";

// SKELETON for the second red run: signatures only, every check lets the request through.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      team?: { id: number };
    }
  }
}

export function requireRole(..._roles: Role[]): RequestHandler {
  return (_req, _res, next) => next();
}

export function parseId(raw: unknown): number | null {
  return Number(raw);
}

export function teamScope(_user: AuthUser): Prisma.TeamWhereInput {
  return {};
}

export async function canAccessTeam(_user: AuthUser, _teamId: number): Promise<boolean> {
  return true;
}

export async function assertTeamAccess(_user: AuthUser, _teamId: number): Promise<void> {}

export const requireTeamAccess = asyncHandler(async (req, _res, next) => {
  req.team = { id: Number(req.params.teamId) };
  next();
});
