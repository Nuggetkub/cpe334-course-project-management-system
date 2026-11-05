import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, setSessionEndedHandler } from "../src/api";
import { clearToken, setToken, TOKEN_KEY } from "../src/auth/token";

// Holds the response until the test decides, so the stored token can change meanwhile.
function deferredFetch() {
  let respond!: (res: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    respond = resolve;
  });
  vi.stubGlobal("fetch", vi.fn(() => pending));
  return (status: number) => respond(Response.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }, { status }));
}

beforeEach(() => {
  sessionStorage.clear();
  return () => setSessionEndedHandler(null);
});

describe("late 401 from an older session (AC-01.10)", () => {
  it.each([
    ["the user signed in again", () => setToken("new-session"), "new-session"],
    ["the user logged out", () => clearToken(), null],
  ])("TEST-01.10c changes nothing when %s", async (_label, changeSession, expectedToken) => {
    const sessionEnded = vi.fn();
    setSessionEndedHandler(sessionEnded);
    setToken("old");
    const respond = deferredFetch();

    const request = apiFetch("/api/teams/mine");
    changeSession();
    respond(401);

    await expect(request).rejects.toBeInstanceOf(ApiError);
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe(expectedToken);
    expect(sessionEnded).not.toHaveBeenCalled();
  });
});
