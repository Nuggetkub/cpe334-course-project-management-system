import { HttpError } from "../errors.js";

// F-09 contract §1 "Retry design": one attempt reads max(version) and inserts max + 1 in its own
// transaction. A failed attempt is rolled back, so the next one re-reads the latest version. Only a
// (milestone_id, version) uniqueness collision is retried: Prisma P2002 on that index, which Prisma
// reports as meta.target ["milestone_id", "version"]. Any other error, including a P2002 on another
// unique constraint or with no target, is rethrown unchanged.
const VERSION_KEY = ["milestone_id", "version"];
function isVersionCollision(error: unknown) {
  const { code, meta } = (error ?? {}) as { code?: unknown; meta?: { target?: unknown } };
  const target = meta?.target;
  return code === "P2002" && Array.isArray(target)
    && target.length === VERSION_KEY.length && VERSION_KEY.every((column) => target.includes(column));
}

export async function insertNextVersion<T>(attempt: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let tries = 1; ; tries += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (!isVersionCollision(error)) throw error;
      if (tries >= maxAttempts) {
        throw new HttpError(409, "SUBMISSION_CONFLICT", "Another submission was saved at the same moment. Please try again.");
      }
    }
  }
}
