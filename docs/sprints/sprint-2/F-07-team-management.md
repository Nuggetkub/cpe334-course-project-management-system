# F-07 Supervisor team management. Engineering contract

**Issue:** [#80](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/80) · **Owner:** @Earth2509 · **Reviewer:** @Nuggetkub · **Implementation branch:** `feature/80-f07-team-management`

**Requirements:** FR-07, BR-01–BR-04, BR-16, NFR-03, NFR-05, NFR-10; DEC-02, DEC-09, DEC-10. **Dependencies:** F-02 and F-03.2 for team management. The submission/removal integration requires [F-08](F-08-milestone-lifecycle.md) v0.4 and the merged [F-09](F-09-resubmission.md) implementation before F-07 can merge or release. The docs, team creation/add work and their tests do not need to wait for F-09.

**Baseline:** [SRS](../../srs.md) v0.3, [System SDS](../../system-sds.md), [F-02](../sprint-1/F-02-authz.md), [F-03.2](../sprint-1/F-03-team-views.md) and [F-05](../sprint-1/F-05-submission.md); released `v0.4.0` (`aa191ba`), contract base `staging/sprint-2` (`abbd644`). AC and TEST IDs below are planned, not executed evidence.

| Version | Date (ICT) | Author | Reviewer | Change |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-11-24 | @Earth2509 | @Nuggetkub (requested) | Proposed design, acceptance criteria and STS before tests and implementation. |
| 0.2 | 2026-11-24 | @Earth2509 | @Nuggetkub (re-review pending) | [PR #91 review](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/91#pullrequestreview-6043130525): shared lock order and ownership, runnable STS, consistent input handling, Cloud Run preflight and D2 priorities. |

## 1. Feature design

- A Supervisor creates a team in the deployment's one course offering (AS-01), including when they have no teams yet. The creator is the only initial supervisor; the membership roster starts empty. Resolve the single configured course from existing course data, never from a caller-supplied ID. With no course or more than one course configured, return `409 COURSE_UNAVAILABLE` without writing.
- Assigned Supervisors, including co-supervisors, manage a shared roster. Add only an unassigned Student. There is no enrollment entity: the single-offering candidate pool is existing unassigned Student accounts, not all users or members of another team. Identify candidates by ID rather than display name, which need not be unique.
- Remove only a membership of the addressed team, and only if the student has never authored a submission for any milestone of that team. Check **all** versions by author and milestone team, not just the latest one. A submission by another member does not block removal. If removal succeeds, the student returns to the existing no-team state and loses team-scoped access on the next request without needing to sign out.
- No team rename, team deletion, transfer, account creation, supervisor reassignment or changes to submission/feedback contents. No schema or data migration: `Team(courseId, name)`, `SupervisorTeam(supervisorId, teamId)` and `TeamMember.studentId` already give the required constraints. The server treats these constraints as authoritative when requests race.

**D2 Cloud Run preflight.** The [Lab 5 deployment record](../../labs/lab05/deployment.md) documents the opt-in demo seed. `server/prisma/demo-seed.ts` upserts one course (`CPE334-DEMO`), but it does not remove other courses, so this does not establish the live row count. **Live verification pending.** @Nuggetkub, as deployment owner, should verify the count against the exact database/schema used by the D2 Cloud Run revision using a read-only `SELECT COUNT(*) FROM courses;` and record the revision, time and aggregate result before the demo. Expected: `1`. A different count, or no verified result, leaves this preflight unconfirmed; do not re-seed or delete rows to make it pass.

### API and errors

All routes use `requireAuth` → `requireRole("SUPERVISOR")`. Team-scoped routes then use `requireTeamAccess` **before** parsing body, candidate query or member ID. Keep the existing `{ error: { code, message, fields? } }` envelope and identical generic `404 NOT_FOUND` for missing and out-of-scope resources (DEC-10). Unauthenticated requests get `401`; authenticated Students get `403`. Keep literal `GET /api/teams/mine` ahead of the new team-ID route; existing F-03.2 response shapes do not change.

| Method and path | Input | Success | Additional behavior |
| --- | --- | --- | --- |
| `POST /api/teams` | JSON `{name}`; string, trimmed, 1–120 Unicode code points | `201 {team: {id, name}}` | Use one Prisma nested create for Team and its creator assignment; both persist or neither does. `400 VALIDATION_ERROR` on `fields.name`; exact trimmed duplicate in the course gives `409 TEAM_NAME_UNAVAILABLE` on `fields.name`, without returning the conflicting team's ID or owner. Uniqueness follows existing case-sensitive storage; no case folding. |
| `GET /api/teams/:teamId` | Canonical team ID | `200 {team: {id, name, members}}` | `members` contains only `{id, name}`, ordered by ID; empty is `[]`. |
| `GET /api/teams/:teamId/member-candidates` | Optional `q` (trimmed, max 120 code points; case-insensitive display-name substring), `page` (positive integer, default 1) | `200 {students, page, hasMore}` | Only unassigned Students; at most 25 `{id, name}` entries ordered by name then ID. Bad filters give `400 VALIDATION_ERROR` on the respective field. No email, credentials, or roster of another team is returned. |
| `POST /api/teams/:teamId/members` | JSON `{studentId}`; positive int4 JSON number | `201 {member: {id, name}}` | Invalid shape/ID gives `400 VALIDATION_ERROR` on `fields.studentId`. A missing account, wrong role or already-assigned Student (including the same team or a stale selection) all give `409 STUDENT_UNAVAILABLE` with the same message; no existing team is disclosed and no membership is moved. |
| `DELETE /api/teams/:teamId/members/:studentId` | Canonical positive int4 member ID; no body | `204`; no body | Invalid ID or no matching membership in this team gives generic `404 NOT_FOUND`. An authored submission gives `409 MEMBER_HAS_SUBMISSIONS`. No deletion of a User, Submission or Feedback. |

Malformed JSON follows the existing `400 BAD_REQUEST` convention after the relevant guards. As in F-04, F-05 and F-08, ignore unknown POST fields: pick only `name` or `studentId` explicitly and validate that required field even when unknown fields are present. Never pass the original body to Prisma. Course and creator come from server state and the authenticated actor, and team scope comes from the guarded route. Duplicate-name and membership conflicts must map to their specified `409` after a database uniqueness violation, rather than returning a raw database error.

### Keep removal and submission consistent

An authorization check performed before submission creation is not sufficient when membership can change. F-08's milestone lock is already on `staging/sprint-2` ([#90](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/90), merge `9119d59`). F-07 owns adding the membership recheck to F-09's shared submission insert **after F-09 merges**, including the first submission and every resubmission/retry. There is no second insert path or nested transaction:

1. **Every transaction that takes both locks takes the milestone row first, then the membership row.** In each F-09 insert attempt's write transaction, keep F-08's milestone lock and re-read; then lock and recheck the matching `TeamMember` row (student and milestone team) using a parameterized row-lock query. If missing, return the generic `404`. Preserve the early F-02 guards and, when membership is still valid, F-08/F-09's close/window and version behavior. Hold both locks through insertion and commit. Each fresh retry transaction takes both locks again in the same order and re-reads before allocating a version.
2. Removal locks **only** its `TeamMember` row, then checks authored submissions (a read, not a milestone lock) and deletes only that membership in the same transaction. F-08 close and PATCH lock **only** the milestone row. None of these paths acquires the two locks in reverse order.
3. If a successful submission commits first, removal returns `409`. If removal commits first, the submission is rejected with `404` and creates no row. Other-team membership and other authors' submissions do not block removal.

Implementation touchpoints: `server/src/teams/routes.ts` and a team-membership service/validator; reuse `server/src/auth/authorize.ts`; add the membership check to F-09's versioned insert service (the successor to `server/src/submissions/service.ts`'s F-05 insert). No change to GET response shapes, team-status rules, or existing feedback links.

## 2. UI design

- Supervisor **My teams** retains the existing links to milestones. Show **Create team** even when the list is empty. After creation, refresh the list and open the new team's management view. Student **My team** remains read-only and keeps its existing empty-state copy.
- The management view shows the selected team's roster and an Add Student picker with search and paging. Show loading, empty and recoverable error states for the list, roster and candidates. Confirm removal by displaying the selected member's name. Refresh the roster and candidates after a successful write; a response for a previous team must not overwrite the current view.
- Use labeled controls, field errors next to the relevant input, an announced server error when no field applies, and disabled submit controls while saving. Keep the team name or candidate selection on failure, explain a stale-candidate conflict and offer to refresh, and keep a protected member visible with the removal error. On a session `401`, retain F-01's return-to-login behavior.

## 3. Acceptance criteria

| AC | Acceptance | Requirements |
| --- | --- | --- |
| AC-07.1 | Creating a valid team persists exactly one team and one creator assignment; only the creator initially sees it in My teams. An invalid name, unavailable course, duplicate, or failed assignment leaves no orphan or duplicate team. | FR-07, BR-01, BR-02 |
| AC-07.2 | An assigned Supervisor can see their own roster and add an unassigned Student. The Student sees the new team on the next read; unavailable candidates never cause a transfer or a second membership. | FR-07, BR-02, BR-04 |
| AC-07.3 | Removal of a member without authored work succeeds, including when a different member submitted. The removed student sees the no-team state and their team-scoped requests return generic `404`. | FR-07, BR-03, BR-04, BR-16 |
| AC-07.4 | Removal of an author, including the author of an older version, returns `409` and leaves membership and work unchanged. A removal and submission for that author racing cannot both succeed. | BR-16 |
| AC-07.5 | New routes enforce `401 → 403 → 404` before validation on scoped requests; unrelated teams receive the same `404` as missing resources and rejected writes leave all affected rows unchanged. | BR-01–BR-03, NFR-03, NFR-05 |
| AC-07.6 | Supervisor controls show loading, empty, validation and retryable server errors without clearing valid inputs or leaking a previously selected team's roster. Students see no management controls. | FR-07, NFR-10 |

## 4. Software Test Specification

**Levels:** U = Vitest unit validation; I = Supertest + PostgreSQL `cpms_test`; C = React with mocked fetch; E = Playwright with isolated `cpms_e2e`. Reuse the F-02 fixture (team A/B, co-supervisor A, one unassigned Student); add dedicated students/milestones only where needed.

| Test ID | AC | Level | Setup and action | Expected |
| --- | --- | --- | --- | --- |
| TEST-07.1u | 07.1, 07.2 | U | Parse trimmed names of 1/120 characters, blank and 121-character names; add with positive int4, 0, out-of-range and string ID; include extra fields with valid and missing required fields. | Normalized results contain only allowed fields; invalid/missing names and IDs map to their fields. |
| TEST-07.1i | 07.1 | I | Supervisor with no assigned team creates a team with extra `courseId` and `supervisorId` fields; another Supervisor tries the exact trimmed name. In independent empty/multiple-course fixtures, try creation with a valid name. | `201` persists one team and only the caller's association in the actual course; duplicate gives `409 TEAM_NAME_UNAVAILABLE` and changes neither row count; unavailable course gives `409 COURSE_UNAVAILABLE` and writes nothing. No artificial assignment failure; atomicity of the parent/child write is provided by the nested create. |
| TEST-07.2i | 07.2 | I | Co-supervisor A lists roster and candidates (include unassigned Students, a Supervisor and members of both teams); search, page and try invalid query. Add the unassigned Student; GET their own team; try adding that Student again to A and to B. | Minimal roster/candidate shapes, stable page order, `400` for invalid query, `201` and immediately visible membership, stale/duplicate add `409` with no team details and one membership. |
| TEST-07.2bi | 07.2 | I | Two allowed Supervisors add the same unassigned Student to different teams concurrently. | Exactly one `201`, one generic `409 STUDENT_UNAVAILABLE` and one persisted membership. |
| TEST-07.3i | 07.3 | I | Team A has an existing submission by one Student; remove another member who has not submitted. Read `/api/teams/mine` and a team milestone as the removed Student. | `204`, removed membership only, both GETs generic `404`; other members, work and feedback unchanged. |
| TEST-07.4i | 07.4 | I | Seed two versions on a team A milestone: target authored v1, teammate authored v2. Attempt removal of the v1 author. | `409 MEMBER_HAS_SUBMISSIONS`; membership, both submissions and any feedback remain intact. |
| TEST-07.4bi | 07.4 | I | Use real PostgreSQL and fresh fixtures with an open milestone, no prior submission and a matching membership. Call removal and the shared insert service directly in each committed order, awaiting the first call before starting the second. Then launch both calls together on a fresh fixture with `Promise.allSettled`. No production test hook, sleep or assertion about who wins the race. | Submit first: a version persists, removal rejects `409 MEMBER_HAS_SUBMISSIONS`, membership remains. Remove first: membership disappears, insert rejects generic `404`, zero versions. Concurrent calls must end in exactly one of those two outcomes; verify error and both row counts. The direct insert call after removal specifically checks the transactional recheck without relying on the route's earlier ownership guard. |
| TEST-07.5i | 07.5 | I | Add the five routes to the F-02 unauthenticated endpoint matrix. Exercise wrong role, team B Supervisor on team A, missing team, malformed body/query and foreign/missing member as applicable. | Correct guard precedence and byte-equivalent generic `404` envelope for hidden/missing targets; no returned roster data or writes on denial. |
| TEST-07.6c | 07.6 | C | Load empty Supervisor list, fail create with a field error and retry; fail roster and candidate loads, switch teams mid-fetch, fail removal and open Student view. | Labeled controls, loading/empty/error/retry feedback, retained input, no stale roster, protected member stays visible and no Student controls. |
| TEST-07.1e | 07.1–07.3, 07.6 | E | Dedicated Supervisor and unassigned Student. Create team, add Student, verify the Student's My team after sign-in, remove before any submission, reload both roles. | Supervisor sees persisted team with empty roster; Student returns to the no-team state with no management controls. |

Use dedicated synthetic E2E accounts in `server/scripts/e2e-prepare.ts`; modifying the shared F-04, F-05 or F-06 teams would invalidate their existing fixtures. Keep `server/tests/team-views.test.ts`, `client/tests/team-views.test.tsx`, the submission/feedback suites and current browser journeys as regression. Update the protected endpoints registry for the additive routes without weakening existing checks. CI `test-and-docker` and Playwright are reported separately.

## 5. Delivery and review gates

- [ ] @Nuggetkub reviews this contract before tests and implementation. Confirm the candidate data boundary, the duplicate-name rule and the shared membership lock with the F-09 owner.
- [ ] Commit tests separately; record a behavior-driven RED against the pre-change application (e.g. create expects `201` but the route is absent). Use test-safe stubs only if needed to avoid import errors, and do not count fixture or compile failures as RED.
- [ ] Implement and record GREEN and unchanged regression with commit IDs, commands and counts. Update the feature inventory/System SDS and central traceability with actual outcomes; this contract's table holds the planned mapping.
- [ ] D2 priority if time is tight: complete the server rules and integration coverage first (`TEST-07.1i`–`TEST-07.5i`, including `07.2bi` and `07.4bi`). Keep the UI acceptance criteria; list any incomplete UI states and unrun checks as gaps in D2 and the remaining-work plan, without calling F-07 complete.
- [ ] Teammate reviews implementation into `staging/sprint-2`; release through the reviewed main PR. Record a deployed team-management check and a preserved Sprint 1 Student journey in D2.

Drafted with OpenAI Codex assistance; peer review and all execution evidence are pending.
