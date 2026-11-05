# F-03.2 — Protected team views

**Requirements:** FR-05, FR-06, BR-01, BR-02, BR-03, BR-04, NFR-02, NFR-03, NFR-10. **Decisions:** DEC-02, DEC-10. **Issue:** #8.

| Version | Date | Author | Reviewer | Change |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-11-04 | @Earth2509 | @Nuggetkub | Initial contract for Issue #8, following F-03.1 and F-02 |
| 0.2 | 2026-11-04 | @Earth2509 | @Nuggetkub | Record implementation commits, verification scope, and manual review steps |
| 0.3 | 2026-11-05 | @Earth2509 | @Nuggetkub | Expand permissions, acceptance criteria, STS and completion gates after PR #32 review; re-review pending |

## Scope

Implement the read-only team pages for FR-05 and FR-06 using the schema from F-03.1 and authorization helpers from F-02. Team creation, membership changes and milestone data are outside this increment.

## API contract

| Request | Required role | Success | Empty case |
| --- | --- | --- | --- |
| GET /api/teams/mine | STUDENT | 200 `{ team: { id, name, members: [{ id, name }], supervisors: [{ id, name }] } }` | 404 standard `NOT_FOUND` |
| GET /api/teams | SUPERVISOR | 200 `{ teams: [{ id, name }] }` | 200 `{ teams: [] }` |

Both endpoints use `requireAuth` before `requireRole`. Missing or invalid sessions return 401; wrong roles return 403. The API derives team scope from the authenticated user through `teamScope`, never from a client-provided user or team ID. Sort teams by name then ID, and people by ID. Select only the listed response fields; never return email, password hashes or session data.

## UI contract

- **My team** (`/team`): show the team name, members and supervisors. An unassigned Student sees “You are not assigned to a team yet” and no team or milestone data on this page.
- **My teams** (`/teams`): show only assigned teams. When there are none, show “No teams assigned yet”.
- Both pages show an announced loading message while fetching and a safe error with a Retry button on failure. Only the expected Student `404 NOT_FOUND` is an empty state. Direct navigation to the other role’s page does not fetch its API.

## Workflow and permissions

Authenticate the session → open the role-specific view → render loading → API checks session and role → query using the signed-in user's team scope → render the roster, list or empty state. A fetch failure shows a safe error; Retry repeats the same scoped request.

| Endpoint | No valid session | Assigned Student | Unassigned Student | Supervisor |
| --- | --- | --- | --- | --- |
| GET /api/teams/mine | 401 | 200 own team and roster | 404 NOT_FOUND | 403 |
| GET /api/teams | 401 | 403 | 403 | 200 assigned teams only, or an empty list |

## Acceptance criteria

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-03.3 | A signed-in Student belongs to a team | They open My team | The page shows that team's name, members and assigned supervisors; another team's records and private user fields are absent. |
| AC-03.4 | A signed-in Student has no membership | They open My team | The API returns the standard 404; the page says “You are not assigned to a team yet” and shows no team data. |
| AC-03.6 | A signed-in Supervisor has assignments | They open My teams | Only their assigned teams appear, including teams they co-supervise. |
| AC-03.7 | A signed-in user opens the permitted team page | Its request is pending, returns no assignments for a Supervisor, or fails unexpectedly | The page announces loading while pending, shows “No teams assigned yet” for an empty Supervisor list, and offers a safe error and Retry on unexpected failure. |

The shared [traceability matrix](../../traceability.md) supplies AC-02.1 (authentication) and AC-02.2 (API role checks). The direct-navigation UI check is supplementary, not a substitute for either API guard.

## Software test specification (STS)

I = API integration against PostgreSQL; C = React component/application test with mocked HTTP. Repeated TEST-02.1 IDs are parameterized shared guard cases; the endpoint and input distinguish each test.

| Test ID | Linked AC | Level | Precondition/input | Action | Expected result |
| --- | --- | --- | --- | --- | --- |
+| TEST-02.1 | AC-02.1 | I | no header | GET `/api/teams/mine` | 401 standard UNAUTHENTICATED; no team data |
| TEST-02.1 | AC-02.1 | I | another scheme (Basic) | GET `/api/teams/mine` | 401 standard UNAUTHENTICATED; no team data |
| TEST-02.1 | AC-02.1 | I | an empty bearer token | GET `/api/teams/mine` | 401 standard UNAUTHENTICATED; no team data |
| TEST-02.1 | AC-02.1 | I | an unknown token | GET `/api/teams/mine` | 401 standard UNAUTHENTICATED; no team data |
| TEST-02.1 | AC-02.1 | I | no header | GET `/api/teams` | 401 standard UNAUTHENTICATED; no team data |
| TEST-02.1 | AC-02.1 | I | another scheme (Basic) | GET `/api/teams` | 401 standard UNAUTHENTICATED; no team data |
| TEST-02.1 | AC-02.1 | I | an empty bearer token | GET `/api/teams` | 401 standard UNAUTHENTICATED; no team data |
| TEST-02.1 | AC-02.1 | I | an unknown token | GET `/api/teams` | 401 standard UNAUTHENTICATED; no team data |
| TEST-03.3 | AC-03.3 | I | Student A; query names Team B and Student B | GET `/api/teams/mine` | 200, Team A and exact public roster fields only |
| TEST-03.4 | AC-03.4 | I | Student without membership | GET `/api/teams/mine` | Standard 404 |
| TEST-03.6 | AC-03.6 | I | Co-supervisor of Team A; query names Team B's supervisor | GET `/api/teams` | 200, only Team A |
| TEST-03.7 | AC-03.7 | I | Remove the signed-in Supervisor's assignment | GET `/api/teams` | 200 with an empty list |
| TEST-03.8 | AC-02.2 | I | Authenticated Student and Supervisor | Each calls the other's endpoint | Standard 403 on both |
| TEST-03.3c | AC-03.3, AC-03.7 | C | Student; delayed successful roster response | Open `/team`, resolve request | Loading status, then team name, member and supervisor |
| TEST-03.4c | AC-03.4 | C | Student; standard 404 | Open `/team` | No-team message |
| TEST-03.6c | AC-03.6 | C | Supervisor; one assigned team | Open `/teams` | Assigned team displayed |
| TEST-03.7c | AC-03.7 | C | Supervisor; 500 with internal details, then empty response | Open `/teams`, select Retry | Safe error, no internal detail, then empty-list message |
| TEST-03.8c | Supplementary to AC-02.2 | C | Student navigating to Supervisor page | Open `/teams` directly | Permission alert; no team API call |
| TEST-03.8c | Supplementary to AC-02.2 | C | Supervisor navigating to Student page | Open `/team` directly | Permission alert; no team API call |

## Definition of Done

- [x] Contract predates implementation; FR/BR/NFR, decisions, observable AC and test cases are documented.
- [x] Protected routes derive scope from the session and return only intended fields; both views cover loading, empty and failure states.
- [x] API and component tests have red/green evidence; record verification scope and known limits.
- [ ] Peer re-review confirms the revised contract and test mapping; merge the PR into `staging/sprint-1`.
- [ ] Update Issue #8 and the project board once both F-03 increments have been accepted.

### API verification

Command: `npm --prefix server test -- tests/team-views.test.ts tests/authz.test.ts` against local PostgreSQL's dedicated test schema.

- Red at test-only commit `ab4ddd4`: 12 failed, 25 passed. The two unmounted routes returned 404; the no-team test also passed against that generic 404, so it alone was not evidence of the intended behavior.
- Green after mounting the two team routes: 37 passed across both files. Server typecheck passed. UI verification is separate.

### UI verification

- Red at `bfd03a1`: all six new team-view tests failed against the placeholder pages.
- Green after wiring the team pages: `npm --prefix client test` passed 14 tests across two files (six team-view tests and eight authentication regressions); `npm --prefix client run build` passed.
- The UI tests exercise route and role handling with mocked HTTP responses. The API tests above verify real PostgreSQL-backed access control separately.

## Review handoff

Implementation on `feature/8-f03-team-views`: API `21d91b0`, UI `26f1331`. The author also verified the server build. In [PR #32 review](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/32#pullrequestreview-5772328780), @Nuggetkub independently reported 81/81 server tests and 14/14 client tests passing on `f4056fc`, with both builds and server typecheck passing. The two passing browser journeys covered F-01, not F-03.2.

With [local setup and demo seed](../../../README.md) complete:

1. Sign in as a seeded Student and open **My team**. Compare the displayed name, members and assigned supervisors to the seeded membership. Visit `/teams` directly and expect a permission message.
2. Sign in as a seeded Supervisor and open **My teams**. Compare the list to that account's assignments. Visit `/team` directly and expect a permission message.
3. With an unassigned Student, expect the no-team message; with an unassigned Supervisor, expect the empty list message. These states are covered by the automated API and UI tests even if the local seed has no unassigned Supervisor.
4. While signed in, delay or block the team request in browser developer tools. Check the loading or error message, restore the request, and select **Retry** after an error.

Review target: `staging/sprint-1`. Do not treat local verification as peer approval, merge, or release evidence.
