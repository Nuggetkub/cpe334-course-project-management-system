# System-level software design specification

Version 0.1 · 2026-11-04 · D1 Part C · Issue #3

This document describes the system design. The [SRS](srs.md) defines required behavior, the [decision log](decisions.md) records design decisions, and the [traceability matrix](traceability.md) maps requirements to verification. The baseline reviewed here is Sprint 1 staging at `e6fa4c5`: F-01, F-02 and F-03.1 are integrated. F-03.2 and later features below are design scope, not a claim of release. Feature contracts specify concrete endpoints and tests.

## Architecture and enforcement

- **Browser:** React, Vite and TypeScript handle routing, role-specific navigation, accessible status messages and field feedback. UI visibility is not an authorization boundary.
- **API:** Express and TypeScript authenticate requests, enforce role and ownership, validate input and apply business rules before writing. Prisma scopes reads by authenticated identity and supplies transactions for multi-row writes.
- **Database:** PostgreSQL stores identities, assignments, sessions and project records. Foreign keys, uniqueness and indexes protect relationships and support scoped queries. Vitest/Supertest cover unit and API behavior; Playwright covers browser workflows.
- **Runtime:** During development Vite and Express run separately. The production design serves the built client and API from one Express container, with SPA fallback outside the API namespace.

## Data model

| Entity | Relationships and integrity |
| --- | --- |
| User / Session | One role per User (Student or Supervisor), unique normalized email, password hash only. User 1:N Session; each session stores a unique token hash and expiry. |
| Course / Team | Course 1:N Team. Course code is unique; team name is unique within its course. Sprint 1 has one offering. |
| TeamMember | Team 1:N membership rows, each pointing to a student. The current single-offering schema uses student ID as the membership key, allowing zero or one team per student. |
| SupervisorTeam | Team N:M supervisors through assignments; composite key prevents duplicate assignments and supports co-supervision. |
| Milestone (planned) | Team 1:N Milestone for the Sprint 1 create/view flow; store title, description and UTC due time. Sprint 2 adds lifecycle fields and guards against removing records with submissions. |
| Submission (planned) | Milestone 1:N versions over time; each version belongs to its team scope and author. Enforce unique versions within the team/milestone scope; Sprint 1 accepts only one submission per team/milestone. Allocate the next version atomically in Sprint 2. Prior versions remain immutable. |
| Feedback (planned) | Each feedback record points to exactly one Submission version and its supervisor author. Later submissions do not move prior feedback. Validate feedback length (1–2000 characters). |
| Grade (Sprint 2 design) | One grade per team/milestone scope; integer 0–100. Student reads exclude unreleased grades. |

For nested records, resolve the owning team and apply the same ownership check as team routes. Do not trust client-supplied owner, author, role, timestamps or version counters. Server time controls writes: Sprint 1 accepts work through the deadline inclusive. Window status and team submission status are separate; manual close changes the window, not the team status (DEC-13). Sprint 2 late-window writes are marked Late, including a first submission (DEC-14).

Use reviewed Prisma migrations in order; run `prisma migrate deploy` for deployment rather than schema push or reset. The opt-in demo seed uses environment-supplied passwords, can be repeated sequentially without duplicating fixtures, and must run one invocation per schema at a time. Test migrations and seed in a disposable database before deployment; never reset deployed data. See [F-03.1](sprints/sprint-1/F-03-seed.md).

## API, identity and permissions

API routes live under `/api` and return JSON except intentional no-content responses and the planned CSV export. Failures use `{ "error": { "code": "...", "message": "..." } }`, optionally with field messages for validation. Never expose SQL, stack traces or raw internal errors. For protected writes, check authentication (401), role (403), and ownership (404) before parsing and validating the body (400). Cross-team access has the same outward 404 as a missing record.

| Operation | Student | Supervisor |
| --- | --- | --- |
| Session identity/logout | Own session | Own session |
| Team view | Own roster via planned `GET /api/teams/mine`; no team → 404 | Assigned list via planned `GET /api/teams`; no assignments → empty list |
| Milestones | Read own team's | Read/create for assigned teams; lifecycle edits in Sprint 2 |
| Submissions | Read/submit for own team in allowed window | Read assigned teams' versions; no student submission writes |
| Feedback and grades | Read own team's feedback and released grades | Record feedback for assigned teams; record/release grades in Sprint 2 |
| Team administration and reporting | No team-management writes; own progress in Sprint 3 | Manage assigned teams in Sprint 2; assigned-team overview/export in Sprint 3 |

`POST /api/auth/login` verifies bcrypt (configured work factor at least 10; default 12), then returns an opaque token and public user data. The browser keeps the token in sessionStorage and sends it as Bearer; PostgreSQL stores only its SHA-256 hash. `GET /api/auth/me` verifies the session on reload; expiry is fixed at eight hours. `POST /api/auth/logout` revokes the presented session; the browser clears its token. Never log tokens or passwords. See [authentication](sprints/sprint-1/F-01-auth.md) and [authorization](sprints/sprint-1/F-02-authz.md).

## Screens and states

| Screen | Navigation and states |
| --- | --- |
| Login and protected shell | Anonymous access redirects to login. Show field validation, safe sign-in errors and loading while checking the session. |
| My team / My teams | Student opens own roster; supervisor opens assigned list. Announce loading; show role-specific no-team text; show safe error and Retry on fetch failure. Wrong-role direct navigation must not fetch that view. |
| Milestones and submission | Open via role navigation and team scope. Show loading/empty/error, deadline and team statuses, and field-level errors. Do not display another team's record on 404. |
| Feedback, grades and progress | Show feedback beside its version; distinguish no feedback from an error. Hide unpublished grades from students; Sprint 3 filtered views distinguish no matches from no data. |

## Configuration and planned delivery

`DATABASE_URL` is required server-side; `PORT`, `HOST`, `CLIENT_ORIGINS`, `NODE_ENV`, `CLIENT_DIST_DIR` and `BCRYPT_COST` control runtime configuration. `SEED_DEMO_DATA`, `STUDENT_DEMO_PASSWORD` and `SUPERVISOR_DEMO_PASSWORD` are for opt-in demo seeding; `TEST_DATABASE_URL` is for a disposable test environment. Use the [environment example](../server/.env.example); never commit .env or place secrets in Vite variables.

Planned Lab 5 deployment: build one Docker image, publish it to Artifact Registry, and deploy it to Cloud Run (port 3000 by default, min 0/max 3 planned) backed by Cloud SQL PostgreSQL 16. Secret Manager supplies runtime DB credentials and demo passwords only to the job that needs them. A separate Cloud Run job runs migrations and, when enabled, the demo seed. GitHub Actions uses Workload Identity Federation rather than service-account keys. `/api/health` checks process liveness; `/api/ready` checks DB connectivity and returns 503 when unavailable. Verify deployed auth/health and persistence after a new revision; retain the prior image/revision and verify DB compatibility before traffic rollback. Local Docker Compose supplies a development database; none of these cloud items is claimed as deployed by this document.
