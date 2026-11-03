# Feature Inventory

**Product:** Course Project Management System · **Baseline:** [SRS v0.2](srs.md) · **Issue:** #2

| Version | Date | Author | Reviewer | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-03 | @Nuggetkub | @Earth2509 | Initial inventory from SRS v0.2 |

Feature IDs are stable: a feature keeps its ID even if it moves sprint. Each feature has one GitHub
Issue; Sprint 1 features also have a contract in `docs/sprints/sprint-1/` committed before code.
Cross-cutting qualities that no single feature owns are assigned to a named **system responsibility**
(`SR-xx`). The requirement-by-requirement view is in [traceability.md](traceability.md).

## Features

| ID | Feature | Description | Requirements | Depends on | Sprint | Issue |
|---|---|---|---|---|---|---|
| F-01 | Authentication and session | Log in with email + password, log out, current user (`/api/auth/login`, `/logout`, `/me`); opaque Bearer token stored hashed in a DB session with 8 h expiry; role-based navigation after login | FR-01, FR-02, FR-03, FR-04, NFR-01, NFR-02, NFR-04 | F-03 (seeded users; can start in parallel) | 1 | #6 |
| F-02 | Role and ownership authorization | Backend middleware: Student/Supervisor role checks and team/supervision ownership checks on every protected endpoint; wrong role → 403, other team's records → 404 | BR-01, BR-02, BR-03, NFR-02, NFR-03 | F-01, F-03 | 1 | #7 |
| F-03 | Teams and seed data | Prisma schema + migrations for users, teams, membership, supervisor assignment; idempotent seed (passwords from env); student views own team (or the no-team state), supervisor lists assigned teams | FR-05, FR-06, BR-04, NFR-01 | Scaffold (#5) | 1 | #8 |
| F-04 | Milestones: create and view | Supervisor creates a milestone (title, description, due date) for a supervised team; students see their team's milestones with window and team status per SRS §4.3.1 (Sprint 1 rows) | FR-08, FR-09, BR-05, NFR-06, NFR-10 | F-01, F-02, F-03 | 1 | #9 |
| F-05 | Submit milestone work | Student submits title, description and link for an open milestone; server-time deadline rule; one submission per team per milestone in Sprint 1; team members view the persisted submission | FR-13, FR-14, BR-06, BR-07, BR-09, NFR-06, NFR-10 | F-04 | 1 | #10 |
| F-06 | Feedback on a submission | Assigned supervisor records feedback on a specific submission version; team members read it with the version it refers to | FR-18, FR-19, BR-10 | F-05 | 1 | #11 |
| F-07 | Team management | Supervisor creates a team (auto-assigned) and adds/removes students; removal blocked for students with authored submissions | FR-07, BR-04 (UI), BR-16 | F-02, F-03 | 2 | — |
| F-08 | Milestone lifecycle | Edit title/description, extend the due date, close a milestone, set a late window; Sprint 2 window rows of §4.3.1; no delete once submissions exist | FR-10, FR-11, FR-12, BR-05, BR-11, BR-12, BR-13, BR-14 | F-04 | 2 | — |
| F-09 | Versioned resubmission | Resubmission creates version N+1 (replaces BR-07); full version history; late-window submissions marked Late; feedback stays on its version | FR-15, FR-16, FR-17, BR-08, BR-10, BR-12 | F-05, F-06, F-08 | 2 | — |
| F-10 | Grades and release | Supervisor records/updates a 0–100 grade per team milestone and releases a milestone's grades; students see only released grades | FR-20, FR-21, BR-01, BR-15 | F-02, F-04 | 2 | — |
| F-11 | Student progress board | Per milestone: status, latest version, feedback status, released grade | FR-22 | F-06, F-09, F-10 | 3 | — |
| F-12 | Supervisor overview and filters | All supervised teams × milestones: submitted / late / missing / awaiting feedback; filter by team and status | FR-23, FR-24, NFR-09 | F-06, F-09, F-10 | 3 | — |
| F-13 | CSV export | Download a CSV summary of progress and grades for supervised teams | FR-25 | F-12 | 3 | — |

## System responsibilities

| ID | Responsibility | Requirements | Established | Verified | Issue |
|---|---|---|---|---|---|
| SR-01 | API error and validation conventions — one JSON error shape, no stack traces or SQL, field-level messages in the UI | NFR-05, NFR-10 | 1 (scaffold + F-01) | Every feature's API tests (1); all forms (3) | #5, #6 |
| SR-02 | Configuration, secrets and reproducible setup — all settings from env, `.env.example`, README setup, no secrets in repo or client bundle | NFR-08, NFR-12 | 1 (scaffold #5) | Teammate walkthrough (1); Docker (2); CI secret scan (2) | #5, #16, #17 |
| SR-03 | Delivery pipeline and cloud deployment — Docker image, CI required check on `main` + `staging/**`, Cloud Run + Cloud SQL, persistence and rollback (DEC-11, DEC-12) | NFR-07, NFR-09, NFR-11 | 2 (Lab 5) | Lab 5 evidence (2); performance script (3) | #15–#24 |

## Dependency order

```
Scaffold (#5) ─► F-03 ─► F-01 ─► F-02 ─► F-04 ─► F-05 ─► F-06          Sprint 1
                  │                        │        │       │
                  └────────► F-07          ├► F-08 ─┼► F-09 ◄┘           Sprint 2
                                           └► F-10  │
                                   F-06, F-09, F-10 ─► F-11, F-12 ─► F-13  Sprint 3
```

F-01 and F-03 can be built in parallel once the `User` table exists (it does, from #5): F-01 needs
only seeded users, F-03 adds teams and membership. F-02 is pair work and lands before any
team-scoped endpoint (F-04 onward).
