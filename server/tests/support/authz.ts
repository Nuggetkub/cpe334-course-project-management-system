import { expect } from "vitest";

// Fixed bodies from the F-02 contract §1.4. Later features use these assertions in
// their own 403/404 tests so every endpoint answers in exactly the same way.

export const UNAUTHENTICATED = { error: { code: "UNAUTHENTICATED", message: "Sign in to continue" } };
export const FORBIDDEN = { error: { code: "FORBIDDEN", message: "You do not have permission to do this" } };
export const NOT_FOUND = { error: { code: "NOT_FOUND", message: "Not found" } };

interface Response {
  status: number;
  body: unknown;
}

/** Wrong role (BR-01): 403 with the fixed body and nothing else. */
export function expectForbidden(res: Response): void {
  expect(res.status).toBe(403);
  expect(res.body).toEqual(FORBIDDEN);
}

/** Other team, no team or no such record (DEC-10): indistinguishable from a missing ID. */
export function expectHidden(res: Response): void {
  expect(res.status).toBe(404);
  expect(res.body).toEqual(NOT_FOUND);
}
