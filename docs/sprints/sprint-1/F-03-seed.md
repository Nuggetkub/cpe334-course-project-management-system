# F-03.1 — Course, teams, and demo seed

Issue #8 · Owner: @Earth2509 · Reviewer: @Nuggetkub

| Version | Date | Author | Reviewer | Change |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-11-04 | @Earth2509 | @Nuggetkub | Initial engineering contract |
| 0.2 | 2026-11-04 | @Earth2509 | @Nuggetkub | Document sequential seed runs, safe failure diagnostics, and test levels |

## Scope

Implement the data and seed increment only. Build on the existing User and Session models and F-01's password helper. F-03.2 (protected team views) follows F-02 in a separate PR. Milestones, submissions, and feedback belong to their own features.

## Data and migration

| Entity | Identity and relationship |
| --- | --- |
| Course | Numeric ID and unique seed code; one course offering is supported in Sprint 1. |
| Team | Numeric ID and required course FK; unique name within a course. |
| TeamMember | Student user FK and team FK; unique student ID enforces BR-04 for the single supported offering. No row means unassigned. |
| SupervisorTeam | Supervisor user FK and team FK; composite primary key prevents duplicate assignments. |

Use an additive migration: preserve existing users, hashes, sessions, and IDs. Keep team-side indexes for membership and supervision lookups. A future multi-offering feature must revisit the unique student key. F-02 and future write endpoints must enforce that the linked users have the appropriate role; F-03.1 only creates role-checked fixtures.

## Seed behavior

- Default: no demo data unless `SEED_DEMO_DATA=true`. Reject invalid flag values. Enabled mode requires both `STUDENT_DEMO_PASSWORD` and `SUPERVISOR_DEMO_PASSWORD`, nonblank and no longer than 72 UTF-8 bytes. Do not trim valid passwords or print secrets.
- Seed one synthetic offering, two teams with two students each, two supervisors with different team assignments, and one unassigned Student dedicated to smoke login. No default password is committed.
- Create records using stable keys and upserts in one transaction. A second run must preserve row counts, IDs, existing hashes and assignments; it must not reassign a student already on a different team or change the role of an existing account. Conflicts fail and roll back. Password variables are initial values, not a rotation mechanism.
- Use F-01's `hashPassword()`; no plaintext in the DB. Production secrets are supplied by the deployment environment. The migration-and-seed command must stop if migration fails.
- Run one seed process at a time per schema. Concurrent upserts may race on unique keys; a failed transaction rolls back and is safe to retry once the other process completes.
- Log only controlled seed messages, a fixed error category, and a recognized Prisma code format if available. Do not log raw Prisma messages, connection strings, hashes, inputs, or metadata.

## Acceptance criteria and planned tests

U = unit test; I = PostgreSQL integration test.

| AC | Test | Level | Expected result |
| --- | --- | --- | --- |
| AC-03.1 / AS-01, NFR-12 | TEST-03.1a — migrate and seed twice in isolated PostgreSQL | I | Stable counts/IDs/hashes; two teams with separate supervision and one unassigned smoke Student. |
| AC-03.1 | TEST-03.1b — disabled, missing, blank, or oversized inputs | U/I | Disabled does not write; invalid enabled configuration fails before writes without exposing credentials. |
| AC-03.1 | TEST-03.1c — existing fixture account has the wrong role or a conflicting membership | I | Seed fails atomically; no overwrites or partial fixtures. |
| AC-03.1 / NFR-12 | TEST-03.1d — safe seed diagnostics | U | Report fixed categories and Prisma codes without raw errors or inputs. |
| AC-03.2 / NFR-01 | TEST-03.2 — inspect hashes and sign in with seeded credentials | I | Stored values are bcrypt (cost ≥10); Student and Supervisor can sign in; returned identity/role matches. |
| AC-03.5 / BR-04 | TEST-03.5 — insert a second membership for an existing student | I | PostgreSQL rejects the write; the first membership remains. |

## TDD evidence

- Contract: `5e06ea9`; tests added before implementation in `2a9ec47`; implementation: `9267e42`.
- Historical red re-run at `2a9ec47` on 2026-11-04, from `server/` with a local PostgreSQL test URL and the normal isolated test setup:

  ```text
  npm test -- tests/demo-seed.test.ts
  FAIL  tests/demo-seed.test.ts
  Error: Cannot find module '../prisma/demo-seed.js'
  Test Files  1 failed (1)
       Tests  no tests
  ```

  Exit 1 at suite import. No database behavior assertions ran on this commit; this is missing-module red evidence, not a behavioral failure for individual test cases.
- Original green at `9267e42`: `npm --prefix server test` — 5 files, 41 tests passed on PostgreSQL.

## Definition of done

Contract commit precedes tests and implementation. Record red/green evidence with commit SHAs. Verify migration and repeated seed on a disposable database, preserve the F-01 regression suite, and document local setup and all seed variables. Peer review into `staging/sprint-1`; Issue #8 stays open until F-03.2 is also complete.
