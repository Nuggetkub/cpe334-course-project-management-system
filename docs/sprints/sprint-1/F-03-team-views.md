# F-03.2 — Protected team views

| Version | Date | Change |
| --- | --- | --- |
| 0.1 | 2026-11-04 | Initial contract for Issue #8, following F-03.1 and F-02 |
| 0.2 | 2026-11-04 | Record implementation commits, verification scope, and manual review steps |

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

## Planned verification

| Test | Level | Evidence expected |
| --- | --- | --- |
| TEST-03.3 / AC-03.3 | API, UI | Student sees their own team, members and supervisors, with no other team or private user fields. |
| TEST-03.4 / AC-03.4 | API, UI | Student without membership receives the standard 404 and sees the specified no-team message. |
| TEST-03.6 / AC-03.6 | API, UI | Supervisor sees only assigned teams, including co-supervised teams. |
| TEST-03.7 / AC-03.7 | API, UI | Supervisor without assignments receives an empty list; both pages expose loading and handle failure with Retry. |
| TEST-02.1 and role regression | API | Both routes reject invalid sessions; Students cannot list supervised teams and Supervisors cannot use the Student route. |

Record red/green test evidence before peer review into `staging/sprint-1`. Keep Issue #8 open until both F-03 increments have been accepted.

### API verification

Command: `npm --prefix server test -- tests/team-views.test.ts tests/authz.test.ts` against local PostgreSQL's dedicated test schema.

- Red at test-only commit `ab4ddd4`: 12 failed, 25 passed. The two unmounted routes returned 404; the no-team test also passed against that generic 404, so it alone was not evidence of the intended behavior.
- Green after mounting the two team routes: 37 passed across both files. Server typecheck passed. UI verification is separate.

### UI verification

- Red at `bfd03a1`: all six new team-view tests failed against the placeholder pages.
- Green after wiring the team pages: `npm --prefix client test` passed 14 tests across two files (six team-view tests and eight authentication regressions); `npm --prefix client run build` passed.
- The UI tests exercise route and role handling with mocked HTTP responses. The API tests above verify real PostgreSQL-backed access control separately.

## Review handoff

Implementation on `feature/8-f03-team-views`: API `21d91b0`, UI `26f1331`. The server build also passed. The recorded verification does not include a browser E2E run or a full server-suite rerun.

With [local setup and demo seed](../../../README.md) complete:

1. Sign in as a seeded Student and open **My team**. Compare the displayed name, members and assigned supervisors to the seeded membership. Visit `/teams` directly and expect a permission message.
2. Sign in as a seeded Supervisor and open **My teams**. Compare the list to that account's assignments. Visit `/team` directly and expect a permission message.
3. With an unassigned Student, expect the no-team message; with an unassigned Supervisor, expect the empty list message. These states are covered by the automated API and UI tests even if the local seed has no unassigned Supervisor.
4. While signed in, delay or block the team request in browser developer tools. Check the loading or error message, restore the request, and select **Retry** after an error.

Review target: `staging/sprint-1`. Do not treat local verification as peer approval, merge, or release evidence.
