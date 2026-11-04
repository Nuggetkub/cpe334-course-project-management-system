# F-02 Role and ownership authorization — Engineering Contract

**Issue:** #7 · **Branch:** `feature/F-02-authz` · **Sprint:** 1 · **Owner:** @Nuggetkub (pair work) · **Reviewer:** @Earth2509
**Requirements:** BR-01, BR-02, BR-03, BR-04 (API part) · NFR-02, NFR-03, NFR-05
**Decisions:** DEC-05 (supervisors act only on assigned teams), DEC-07 (one role per account), DEC-10 (cross-team access → 404) · **Traceability:** [traceability.md](../../traceability.md)

| Version | Date | Author | Reviewer | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-04 | @Nuggetkub | @Earth2509 | Contract committed before implementation |

---

## 1. Feature design

### 1.1 Behaviour

F-02 adds no user-visible screen. It provides the **server-side checks every team-scoped endpoint
uses**, so that F-03.2, F-04, F-05 and F-06 never write their own permission logic:

1. **Authentication** (from F-01): `requireAuth` → 401 when there is no valid session.
2. **Role** (BR-01): `requireRole("SUPERVISOR")` / `requireRole("STUDENT")` → **403 `FORBIDDEN`**
   when the caller has the other role.
3. **Ownership** (BR-02, BR-03, BR-04): a caller may touch a team's records only if
   - a **Student** is a member of that team (`team_members`), or
   - a **Supervisor** is assigned to that team (`supervisor_teams`).

   Otherwise the answer is **404 `NOT_FOUND`**, byte-for-byte the same as for an ID that does not
   exist (DEC-10), so other teams' record IDs are never confirmed. A student with no team has no
   team-scoped data: every team-scoped request → 404 (BR-04).

Why 403 for role but 404 for ownership: the role rule is public (every student knows students can't
create milestones), so 403 reveals nothing. Ownership failures would reveal that a record exists.

### 1.2 Workflow (order of checks)

```
request ─► requireAuth ─✗─► 401 UNAUTHENTICATED
              │✓ req.user = { id, role }
              ▼
          requireRole(...)  (only on role-restricted endpoints) ─✗─► 403 FORBIDDEN
              │✓
              ▼
          ownership: parse id → load record's team_id → is caller member / assigned?
              │✗ (malformed id, no such record, other team, student without team) ─► 404 NOT_FOUND
              │✓ req.team = { id }
              ▼
          body validation ─✗─► 400 VALIDATION_ERROR
              │✓
              ▼
          business rules (deadline, duplicates…) and handler
```

The order is fixed: **401 → 403 → 404 → 400**. Ownership runs before body validation so a request
to another team's record with an invalid body still gets 404 (a 400 would confirm the record).
A Student calling a Supervisor-only operation gets 403 even for their own team.

### 1.3 Dependencies

| Depends on | Why | State |
|---|---|---|
| F-01 (#6) | `requireAuth`, `req.user = { id, role, sessionId }`, NFR-05 error helpers | Merged into `staging/sprint-1` (PR #27) |
| F-03.1 (#8) | `teams`, `team_members` (PK `student_id`: one team per student), `supervisor_teams` | PR #28, in review. This branch is based on it; the PR is retargeted to `staging/sprint-1` once #28 merges |
| — | F-03.2, F-04, F-05, F-06 use the helpers below on every team-scoped endpoint | Provided by this feature |

### 1.4 Rules and boundaries

| Rule | Detail |
|---|---|
| Role source | `req.user.role`, loaded from `users` on every request by `requireAuth` (never from the client or the token) |
| Student ownership | `team_members.student_id = caller` for the record's team |
| Supervisor ownership | A row in `supervisor_teams (supervisor_id = caller, team_id)`; a team may have several supervisors, all of whom pass |
| Role-specific path | A Student is never checked against `supervisor_teams` and a Supervisor never against `team_members`, even if bad data puts them there |
| ID parameters | Canonical positive integers `1`–`2147483647` (PostgreSQL `int4`) only. `0`, `-1`, `1.5`, `01`, `1e3`, `abc`, empty or larger values → 404 without querying the database (so no 500 from an out-of-range value) |
| Not-found body | Always `{ "error": { "code": "NOT_FOUND", "message": "Not found" } }` (same as the scaffold's unknown-route 404) |
| Forbidden body | Always `{ "error": { "code": "FORBIDDEN", "message": "You do not have permission to do this" } }` |
| List endpoints | Never filter in memory: lists use the Prisma `where` from `teamScope(user)` so other teams' rows are never loaded |

**Out of scope (disclosed):** client-side role guards on routes (the server is the only enforcement
point; the client only hides navigation, from F-01); audit logging of denied requests; admin role
(DEC-09).

### 1.5 Permission matrix (Sprint 1)

Endpoints are owned by the feature named; paths are proposals and may change in that feature's
contract, but the rule in each cell may not. Each feature adds its endpoints to the protected-endpoint
list (§4) in the same PR.

| Endpoint (feature) | Unauth. | Student own team | Student other team / no team | Supervisor assigned | Supervisor unassigned |
|---|---|---|---|---|---|
| `GET /api/auth/me`, `POST /api/auth/logout` (F-01) | 401 | ✓ | ✓ | ✓ | ✓ |
| `GET /api/teams/mine` (F-03.2) | 401 | ✓ own team | 404 when no team | 403 | 403 |
| `GET /api/teams` (F-03.2) | 401 | 403 | 403 | ✓ assigned teams only | ✓ (empty list) |
| `POST /api/teams/:teamId/milestones` (F-04) | 401 | 403 | 403 | ✓ | 404 |
| `GET /api/teams/:teamId/milestones` (F-04) | 401 | ✓ | 404 | ✓ | 404 |
| `POST /api/milestones/:milestoneId/submissions` (F-05) | 401 | ✓ | 404 | 403 | 403 |
| `GET /api/milestones/:milestoneId/submission` (F-05) | 401 | ✓ | 404 | ✓ | 404 |
| `POST /api/submissions/:submissionId/feedback` (F-06) | 401 | 403 | 403 | ✓ | 404 |
| `GET /api/submissions/:submissionId/feedback` (F-06) | 401 | ✓ | 404 | ✓ | 404 |

---

## 2. Layer specifications

### 2.1 API (server module `server/src/auth/authorize.ts`)

| Export | Behaviour |
|---|---|
| `requireRole(...roles: Role[])` | Express middleware. Must run after `requireAuth`. Caller's role not in `roles` → 403 `FORBIDDEN`. No `req.user` (wired wrongly) → 401, never a pass |
| `parseId(raw: unknown): number \| null` | The ID rule in §1.4 |
| `teamScope(user): Prisma.TeamWhereInput` | Student → `{ members: { some: { studentId } } }`; Supervisor → `{ supervisors: { some: { supervisorId } } }` |
| `canAccessTeam(user, teamId): Promise<boolean>` | `team.count({ where: { id: teamId, ...teamScope(user) } }) === 1` |
| `assertTeamAccess(user, teamId): Promise<void>` | Throws `HttpError(404, "NOT_FOUND", "Not found")` unless `canAccessTeam`. For nested records (milestone, submission) the handler first loads the record's `team_id` (missing record → same 404), then calls this |
| `requireTeamAccess` | Middleware for routes with `:teamId`: `parseId` → `assertTeamAccess` → sets `req.team = { id }` |

`errors.ts` gains a shared `NOT_FOUND` constructor so route 404s and ownership 404s cannot drift apart.

### 2.2 Data

No schema change. Uses F-03.1's `team_members (student_id PK, team_id)` and
`supervisor_teams (supervisor_id, team_id PK)`; both have an index on `team_id`, and the ownership
query is a single indexed `COUNT`.

### 2.3 UI

None in F-02. The client shows the server's `error.message` for 403/404 (already handled by
`ApiError` from F-01); each later feature's contract defines its own empty and error states.

### 2.4 Configuration

None.

---

## 3. Acceptance criteria

IDs are fixed in [traceability.md](../../traceability.md); AC-02.5 is added by this contract.

| AC | Given / When | Then (observable) | Req |
|---|---|---|---|
| AC-02.1 | Any endpoint in the protected-endpoint list, called with no header, another scheme, an empty or an unknown Bearer token | 401 `UNAUTHENTICATED`, body exactly `{error:{code,message}}`, no data | NFR-02 |
| AC-02.2 | A Student calls a Supervisor-only operation (also for their own team); a Supervisor calls a Student-only operation | 403 `FORBIDDEN` with the fixed body; the handler does not run | BR-01, NFR-03 |
| AC-02.3 | A Supervisor addresses a team they are not assigned to | 404 `NOT_FOUND`, identical to a nonexistent team; every assigned supervisor (co-supervision) passes; the supervisor's team scope contains only assigned teams | BR-02, NFR-03 |
| AC-02.4 | A Student addresses another team, or has no team at all | 404 `NOT_FOUND`, identical to a nonexistent team; the student's team scope contains only their own team (or nothing) | BR-03, BR-04, NFR-03 |
| AC-02.5 | Malformed or out-of-range IDs; checks combined on one endpoint | 404 `NOT_FOUND` without a 500; checks run in the order 401 → 403 → 404 | NFR-03, NFR-05, DEC-10 |

---

## 4. Software Test Specification

Levels as in F-01: **U** = unit (no DB) · **I** = API + DB integration (Vitest + Supertest,
`cpms_test` schema). There are no C or E tests: F-02 has no UI.

Because the real team-scoped endpoints arrive with F-03.2–F-06, behaviour is tested on **test-only
probe routes** in `server/tests/authz.test.ts` that use the real middleware (`requireAuth`,
`requireRole`, `requireTeamAccess`) on an Express app built in the test. The probes are never mounted
in `createApp`.

The **protected-endpoint list** `server/tests/support/protected-endpoints.ts` holds every real
protected endpoint (now `/api/auth/me` and `/api/auth/logout`). TEST-02.1 runs against every entry,
so adding an endpoint to the list is enough to cover it for NFR-02. Each later feature's PR adds its
endpoints there and its own 403/404 tests (TEST-0x.y) using the shared assertions `expectForbidden`
and `expectHidden` from `server/tests/support/authz.ts`.

Fixture (`server/tests/support/teams.ts`): one course; teams **A** and **B**; student **sA** in A,
**sB** in B, **s0** in no team; supervisor **pA** assigned to A, **pA2** also assigned to A,
**pB** assigned to B only. Sessions are inserted directly (token hashed with `node:crypto`) so the
fixture does not depend on the login route.

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-02.1 | AC-02.1 | I | Each entry of the protected-endpoint list | Call with no header, `Basic xyz`, `Bearer ` (empty), unknown 43-char token | 401 `{error:{code:"UNAUTHENTICATED",message:"Sign in to continue"}}` each |
| TEST-02.2a | AC-02.2 | I | sA, pA signed in | `GET /probe/supervisor-only` | sA → 403 fixed `FORBIDDEN` body; pA → 200 |
| TEST-02.2b | AC-02.2 | I | sA, pA signed in | `GET /probe/student-only` | pA → 403; sA → 200 |
| TEST-02.2c | AC-02.2 | I | sA signed in | `POST /probe/teams/A/supervise` (Supervisor-only + ownership) for **own** team A | 403 (role before ownership); the handler did not run |
| TEST-02.3a | AC-02.3 | I | pB signed in | `GET /probe/teams/A`, `GET /probe/teams/999999` | Both 404, bodies identical and equal to the fixed `NOT_FOUND` body |
| TEST-02.3b | AC-02.3 | I | pA and pA2 signed in | `GET /probe/teams/A`; `POST /probe/teams/A/supervise` | 200 `{teamId:A}` for both supervisors |
| TEST-02.3c | AC-02.3 | I | pA, pB | `team.findMany({ where: teamScope(user) })` | pA → [A]; pB → [B] |
| TEST-02.4a | AC-02.4 | I | sA signed in | `GET /probe/teams/A`, `/probe/teams/B`, `/probe/teams/999999` | A → 200; B and 999999 → 404 with identical bodies |
| TEST-02.4b | AC-02.4 | I | s0 (no team) signed in | `GET /probe/teams/A`, `/probe/teams/B`; `teamScope(s0)` | 404 for both; scope finds no team |
| TEST-02.4c | AC-02.4 | I | sA, sB | `team.findMany({ where: teamScope(user) })` | sA → [A]; sB → [B] |
| TEST-02.4d | AC-02.4 | I | Bad data: pB also inserted into `team_members` of A | pB `GET /probe/teams/A` | 404: a Supervisor is checked only against `supervisor_teams` |
| TEST-02.5a | AC-02.5 | U | — | `parseId` on `"1"`, `"2147483647"`, `"0"`, `"-1"`, `"1.5"`, `"01"`, `"1e3"`, `"abc"`, `""`, `"2147483648"`, `undefined` | 1, 2147483647, then `null` for every other input |
| TEST-02.5b | AC-02.5 | I | sA signed in | `GET /probe/teams/<id>` for `abc`, `0`, `01`, `2147483648` | 404 fixed body each; never 500 |
| TEST-02.5c | AC-02.5 | I | No token | `POST /probe/teams/B/supervise` | 401 (authentication before role and ownership) |
| TEST-02.5d | AC-02.3, AC-02.4 | I | sA, sB, pB | `assertTeamAccess(user, A)` called directly (nested-record path) | sA resolves; sB and pB reject with `HttpError` 404 `NOT_FOUND` |

**Count (v0.1):** 15 STS rows: 1 unit (U), 14 API+DB integration (I). TEST-02.1 expands to one case per
list entry and header variant; the runner reports more tests than rows.

**TDD evidence:** commit order on this branch is (1) this contract, (2) failing tests TEST-02.x (red
run recorded in the PR), (3) implementation (green run).

---

## 5. Definition of Done

- [ ] `server/src/auth/authorize.ts` implements §2.1; F-01's existing tests still pass.
- [ ] Every test in §4 exists, was seen **failing before** its implementation, and passes; red and
      green runs (command, counts, commit SHA) are in the PR.
- [ ] `server`: `npm run typecheck`, `npm test`; `client`: `npm test`, `npm run build`; root:
      `npm run e2e` — all pass on the PR head. No test skipped, disabled or weakened.
- [ ] Probe routes exist only in tests; `createApp` mounts nothing new.
- [ ] README states the rule for new endpoints: use the helpers, add the endpoint to the
      protected-endpoint list, add 403/404 tests.
- [ ] `traceability.md` gains AC-02.5 and the updated AC-02.1–02.4 wording, with a change-log row.
- [ ] Reviewed and approved by @Earth2509 with a specific check recorded; merged into `staging/sprint-1`
      after #28.
