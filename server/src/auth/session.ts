import { createHash, randomBytes } from "node:crypto";

// NFR-04: a session lasts exactly 8 hours from login and is never extended. Fixed in
// code, not configuration, so no environment value can contradict the requirement.
export const SESSION_TTL_HOURS = 8;
const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;

export function computeExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SESSION_TTL_MS);
}

/** Valid while now < expiresAt; rejected at the exact expiry instant. */
export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= expiresAt.getTime();
}

/** 32 random bytes, base64url: 43 URL-safe characters. Returned to the client once. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this hash is stored, so a database leak does not expose usable tokens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
