// NFR-02: every real protected endpoint, so TEST-02.1 checks each one for 401.
// Each feature PR that adds a protected endpoint adds it here (F-02 contract §4).
// `:id` placeholders are filled with 1; the 401 must come before any lookup.

export interface ProtectedEndpoint {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  feature: string;
}

export const PROTECTED_ENDPOINTS: ProtectedEndpoint[] = [
  { method: "get", path: "/api/auth/me", feature: "F-01" },
  { method: "post", path: "/api/auth/logout", feature: "F-01" },
  { method: "get", path: "/api/teams/mine", feature: "F-03.2" },
  { method: "get", path: "/api/teams", feature: "F-03.2" },
  { method: "get", path: "/api/teams/:teamId/milestones", feature: "F-04" },
  { method: "post", path: "/api/teams/:teamId/milestones", feature: "F-04" },
  { method: "get", path: "/api/milestones/:milestoneId", feature: "F-04" },
  { method: "post", path: "/api/milestones/:milestoneId/submissions", feature: "F-05" },
  { method: "get", path: "/api/milestones/:milestoneId/submission", feature: "F-05" },
];

export function concretePath(path: string): string {
  return path.replace(/:[A-Za-z]+/g, "1");
}
