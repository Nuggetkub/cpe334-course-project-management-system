import type { Role } from "@prisma/client";
import { HttpError, asyncHandler } from "../errors.js";
import { prisma } from "../prisma.js";
import { hashToken, isExpired } from "./session.js";

export interface AuthUser {
  id: number;
  role: Role;
  sessionId: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireAuth; the only source of the caller's identity and role. */
      user?: AuthUser;
    }
  }
}

const UNAUTHENTICATED = () => new HttpError(401, "UNAUTHENTICATED", "Sign in to continue");

/** Reads `Authorization: Bearer <token>`, loads a live session and sets req.user; else 401. */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(req.get("authorization") ?? "");
  if (!match) throw UNAUTHENTICATED();

  const session = await prisma().session.findUnique({
    where: { tokenHash: hashToken(match[1]) },
    include: { user: { select: { id: true, role: true } } },
  });
  if (!session) throw UNAUTHENTICATED();

  if (isExpired(session.expiresAt)) {
    await prisma().session.deleteMany({ where: { id: session.id } });
    throw UNAUTHENTICATED();
  }

  req.user = { id: session.user.id, role: session.user.role, sessionId: session.id };
  next();
});
