import { clearToken, getToken } from "./auth/token";

// Empty base URL = same origin (production: Express serves the UI and the API).
export const API_URL = import.meta.env.VITE_API_URL ?? "";

/** An error response in the API's NFR-05 shape, or a network failure (status 0). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

// AC-01.10: a 401 on a request that carried the current token means the session expired
// or was revoked. It is handled here once, so pages never treat it as their own error.
// A late 401 for an older token (the user has since signed in again or logged out) is ignored.
let onSessionEnded: (() => void) | null = null;

export function setSessionEndedHandler(handler: (() => void) | null): void {
  onSessionEnded = handler;
}

export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Could not reach the server");
  }

  if (res.status === 401 && token && getToken() === token) {
    clearToken();
    onSessionEnded?.();
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error = body?.error ?? {};
    throw new ApiError(res.status, error.code ?? "UNKNOWN", error.message ?? "Request failed", error.fields);
  }
  return body as T;
}
