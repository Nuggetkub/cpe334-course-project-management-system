import { HttpError } from "../errors.js";

// F-09 contract §1 "Retry design": one attempt reads max(version) and inserts max + 1 in its own
// transaction; only a (milestone_id, version) uniqueness collision is retried, up to maxAttempts.
// Interface only until the F-09 tests are committed (test-first).
export async function insertNextVersion<T>(_attempt: () => Promise<T>, _maxAttempts = 3): Promise<T> {
  throw new HttpError(501, "NOT_IMPLEMENTED", "Versioned submissions are not implemented yet.");
}
