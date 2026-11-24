import { HttpError } from "../errors.js";

// F-09 contract §1 "Retry design": one attempt reads max(version) and inserts max + 1 in its own
// transaction. A failed attempt is rolled back, so the next one re-reads the latest version. Only a
// (milestone_id, version) uniqueness collision (Prisma P2002) is retried; anything else is rethrown.
const isUniqueCollision = (error: unknown) => (error as { code?: unknown } | null)?.code === "P2002";

export async function insertNextVersion<T>(attempt: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let tries = 1; ; tries += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (!isUniqueCollision(error)) throw error;
      if (tries >= maxAttempts) {
        throw new HttpError(409, "SUBMISSION_CONFLICT", "Another submission was saved at the same moment. Please try again.");
      }
    }
  }
}
