# F-03.2 — Protected team views

| Version | Date | Change |
| --- | --- | --- |
| 0.1 | 2026-11-04 | Initial contract for Issue #8, following F-03.1 and F-02 |

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
