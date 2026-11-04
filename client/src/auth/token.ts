// The Bearer token lives in sessionStorage: it is cleared when the tab closes, and
// the server's 8-hour expiry and logout bound the damage if it is ever stolen.
// Storage can be unavailable (private mode, blocked site data), so every access
// is guarded; without storage the user simply signs in again after a reload.
export const TOKEN_KEY = "cpms.token";

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Keep working for this page view only.
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing stored.
  }
}
