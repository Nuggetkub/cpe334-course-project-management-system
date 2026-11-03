import { Router } from "express";
import { HttpError, asyncHandler } from "../errors.js";
import { prisma } from "../prisma.js";
import { requireAuth } from "./middleware.js";
import { verifyAgainstDummy, verifyPassword } from "./password.js";
import { computeExpiry, generateToken, hashToken } from "./session.js";

// F-01 contract §2.1: POST /login, GET /me, POST /logout under /api/auth.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicUser = { id: true, name: true, email: true, role: true } as const;

function parseLogin(body: unknown): { email: string; password: string } {
  const { email, password } = (body ?? {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};

  const normalisedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalisedEmail || normalisedEmail.length > 254 || !EMAIL_PATTERN.test(normalisedEmail)) {
    fields.email = "Enter a valid email address.";
  }
  if (typeof password !== "string" || password.length === 0) {
    fields.password = "Enter your password.";
  } else if (password.length > 128) {
    fields.password = "Password must be at most 128 characters.";
  }

  if (Object.keys(fields).length > 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Check the highlighted fields.", fields);
  }
  return { email: normalisedEmail, password: password as string };
}

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = parseLogin(req.body);

    const user = await prisma().user.findUnique({ where: { email } });
    const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyAgainstDummy(password);
    if (!user || !valid) {
      // Same status, code and message for both cases: no account enumeration.
      throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }

    const token = generateToken();
    const createdAt = new Date();
    await prisma().session.create({
      data: { tokenHash: hashToken(token), userId: user.id, createdAt, expiresAt: computeExpiry(createdAt) },
    });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma().user.findUniqueOrThrow({ where: { id: req.user!.id }, select: publicUser });
    res.json({ user });
  }),
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    // Only the presented session ends; the user's other sessions stay valid.
    await prisma().session.deleteMany({ where: { id: req.user!.sessionId } });
    res.status(204).end();
  }),
);
