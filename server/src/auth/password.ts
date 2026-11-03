import bcrypt from "bcryptjs";
import { BCRYPT_COST } from "../config.js";

// NFR-01: passwords are stored only as bcrypt hashes with cost ≥ 10.
export const MIN_BCRYPT_COST = 10;

export async function hashPassword(password: string, cost = BCRYPT_COST): Promise<string> {
  if (!Number.isInteger(cost) || cost < MIN_BCRYPT_COST) {
    throw new Error(`bcrypt cost must be an integer ≥ ${MIN_BCRYPT_COST}, got ${cost}`);
  }
  return bcrypt.hash(password, cost);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
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
