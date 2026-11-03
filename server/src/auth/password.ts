import bcrypt from "bcryptjs";
import { BCRYPT_COST } from "../config.js";

// NFR-01: passwords are stored only as bcrypt hashes with cost ≥ 10.
export const MIN_BCRYPT_COST = 10;

// bcrypt reads only the first 72 bytes of its input and bcryptjs does not enforce
// it, so two passwords sharing those bytes would match the same hash. Longer
// input is rejected, never truncated. Bytes, not characters: Thai is 3 bytes each.
export const MAX_PASSWORD_BYTES = 72;

export function passwordTooLong(password: string): boolean {
  return Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES;
}

export async function hashPassword(password: string, cost = BCRYPT_COST): Promise<string> {
  if (!Number.isInteger(cost) || cost < MIN_BCRYPT_COST) {
    throw new Error(`bcrypt cost must be an integer ≥ ${MIN_BCRYPT_COST}, got ${cost}`);
  }
  if (passwordTooLong(password)) {
    throw new Error(`Password must be at most ${MAX_PASSWORD_BYTES} bytes`);
  }
  return bcrypt.hash(password, cost);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // A longer input can never be a stored password (hashPassword refuses it).
  if (passwordTooLong(password)) return false;
  return bcrypt.compare(password, hash);
}

// Compared against when the email is unknown, so a missing account costs the same
// bcrypt work as a wrong password and response time does not reveal which it was.
let dummyHash: Promise<string> | undefined;

export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= bcrypt.hash("dummy-password-for-timing", BCRYPT_COST);
  await bcrypt.compare(password, await dummyHash);
  return false;
}
