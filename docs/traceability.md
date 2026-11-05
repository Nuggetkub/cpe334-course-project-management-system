# Requirements Traceability

**Baseline:** [SRS v0.2](srs.md) · **Features:** [features.md](features.md) · **Issue:** #2

| Version | Date | Author | Reviewer | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-03 | @Nuggetkub | @Earth2509 | Initial matrix: 25 FR, 16 BR, 12 NFR |
| 0.2 | 2026-11-03 | @Nuggetkub | @Earth2509 | PR #26 review: F-03 increments (F-03.1 / F-03.2); NFR-10 server-error and loading/empty ACs with per-sprint allocation |
| 0.3 | 2026-11-03 | @Nuggetkub | @Earth2509 | PR #26 re-review: Login form UI checks (AC-01.8, AC-01.9); feedback field error shown in the form (AC-06.2) |
| 0.4 | 2026-11-04 | @Nuggetkub | @Earth2509 | PR #27 review: AC-01.2 / AC-01.6 add the 72-byte bcrypt password limit; AC-01.5 states the 8 h lifetime is not configurable |
| 0.5 | 2026-11-04 | @Nuggetkub | @Earth2509 | F-02 contract: AC-02.1–AC-02.4 made precise (identical 404 body, co-supervision, no-team student, Student-only operations); AC-02.5 added (malformed IDs, check order 401 → 403 → 404) |
| 0.6 | 2026-11-04 | @Nuggetkub | @Earth2509 | PR #29 review: AC-02.5 covers malformed/invalid JSON bodies (order 401 → 403 → 404 → 400) |
| 0.7 | 2026-11-04 | @Earth2509 | @Nuggetkub | F-03.2: link team-view acceptance criteria to the implementation contract and test evidence |
| 0.8 | 2026-11-05 | @Nuggetkub | @Earth2509 | F-05 contract: AC-05.1–AC-05.7 made precise (409 codes, simultaneous submits, assigned Supervisors read); AC-05.8 (team status, §4.3.1 S1 rows) and AC-05.9 (Supervisor cannot submit; check order) added |
| 0.10 | 2026-11-05 | @Earth2509 | @Nuggetkub (review pending) | F-04 contract and create/view implementation; AC-04.7 ownership/check order and AC-04.8 pagination added. Version 0.9 is reserved for the separate F-01 session-expiry PR #33 |

## ID conventions

- **AC-ff.n** — acceptance criterion *n* of feature F-*ff*, defined in that feature's contract
  (`docs/sprints/sprint-N/F-ff-*.md`).
- **TEST-ff.n** — the automated test (or named manual check) that verifies AC-ff.n. Test titles
  start with the ID, e.g. `it("TEST-05.3 rejects a submission one second after due_at", …)`, so
  test output can be matched to this table.
- **AC-SR*n*.m / TEST-SR*n*.m** — the same for a system responsibility SR-*n*.

Sprint 1 rows list planned AC IDs. A contract author may split or renumber them, and updates this
table **in the same PR** as the contract. Sprint 2 and 3 rows have a feature and sprint allocation
now; their AC and tests are written with the sprint contract (D1 Part B allows this).

## Sprint 1 acceptance criteria (planned)

| AC | Criterion | Requirements |
|---|---|---|
| AC-01.1 | Valid email + password → 200 `{ token, user: { id, name, email, role } }` and a DB session row | FR-01 |
| AC-01.2 | Wrong password or unknown email → 401 with the same message (no account enumeration); a password over 72 UTF-8 bytes → 400 on `password` | FR-01, NFR-05 |
| AC-01.3 | `GET /api/auth/me` with a valid token → the caller's id, name, email, role | FR-03 |
| AC-01.4 | After `POST /api/auth/logout`, the same token → 401 | FR-02, NFR-04 |
| AC-01.5 | A session is rejected after 8 h (expiry computed at login); the 8 h is fixed in code, not configurable | NFR-04 |
| AC-01.6 | Stored password is a bcrypt hash (cost ≥ 10); passwords over 72 UTF-8 bytes are refused, never truncated; no response contains a `password`/`passwordHash` field | NFR-01 |
| AC-01.7 | After login the UI shows Student or Supervisor navigation; logout returns to the login page | FR-04 |
| AC-01.8 | The Login form shows field-level messages for a missing or malformed email and a missing password, without sending the request; on a 401 it shows one generic message ("Email or password is incorrect") that is the same for wrong password and unknown email | FR-01, NFR-10 |
| AC-01.9 | When login fails on the server (5xx or network error), the Login form shows a visible error, keeps the email, clears the password and lets the user retry | FR-01, NFR-10 |
| AC-02.1 | Every protected endpoint (listed in the protected-endpoint test list) without a valid token → 401, no data | NFR-02 |
| AC-02.2 | A Student calling a Supervisor-only operation (even for their own team), or a Supervisor calling a Student-only operation → 403 | BR-01, NFR-03 |
| AC-02.3 | A Supervisor reading or acting on an unassigned team's records → 404, identical to a nonexistent record; every assigned supervisor passes | BR-02, NFR-03 |
| AC-02.4 | A Student reading another team's records, or a Student with no team → 404, identical to a nonexistent record, no data | BR-03, BR-04, NFR-03 |
| AC-02.5 | Malformed or out-of-range IDs → 404 (never 500); checks run in the order 401 → 403 → 404 → 400, including malformed JSON bodies | NFR-03, NFR-05 |
| AC-03.1 | **[F-03.1]** `npm run prisma:seed` creates demo supervisors, students and teams; a second run creates no duplicates; passwords come from env | AS-01, NFR-12 |
| AC-03.2 | **[F-03.1]** Seeded users' `password_hash` values are bcrypt hashes | NFR-01 |
| AC-03.3 | **[F-03.2]** A Student sees their team name, members and assigned supervisors | FR-05 |
| AC-03.4 | **[F-03.2]** An unassigned Student sees "You are not assigned to a team yet"; team-scoped requests → 404 | FR-05, BR-04 |
| AC-03.5 | **[F-03.1]** The DB rejects a second team membership for the same student | BR-04 |
| AC-03.6 | **[F-03.2]** A Supervisor's team list contains only their assigned teams | FR-06, BR-02 |
| AC-03.7 | **[F-03.2]** Team view and team list show a loading state while fetching; a Supervisor with no teams sees "No teams assigned yet" | FR-06, NFR-10 |
| AC-04.1 | A Supervisor creates a milestone for an assigned team → 201, persisted | FR-08 |
| AC-04.2 | Title outside 1–120 chars or due date not in the future → 400 with field errors shown in the form | BR-05, NFR-10 |
| AC-04.3 | A Student sees their team's milestones with due date in Asia/Bangkok time, window and team status | FR-09, NFR-06 |
| AC-04.4 | Window and team status follow SRS §4.3.1 Sprint 1 rows at `due_at − 1 s`, `due_at`, `due_at + 1 s` | FR-09, NFR-06 |
| AC-04.5 | When creating a milestone fails on the server (5xx or network error), the form shows the error message, keeps the entered values and allows a retry | NFR-10 |
| AC-04.6 | The milestone list shows a loading state while fetching and "No milestones yet" when empty | FR-09, NFR-10 |
| AC-04.7 | Supervisor-only create, team-scoped list/detail and identical hidden/missing 404; malformed JSON cannot outrank 401/403/404 | BR-01–BR-04, NFR-02, NFR-03, NFR-05 |
| AC-04.8 | Team milestone list paginates 50 rows by dueAt ASC/id ASC; team changes cannot show stale prior-team results | FR-09, NFR-10 |
| AC-05.1 | A Student of the milestone's team submits title, description, link while the window is Open → 201, persisted as version 1 with submitter and server time | FR-13 |
| AC-05.2 | Invalid title/description/link → 400 with field errors shown in the form | BR-09, NFR-10 |
| AC-05.3 | Submission at `due_at − 1 s` and at `due_at` accepted; at `due_at + 1 s` → 409 `DEADLINE_PASSED` (server clock; client times ignored) | BR-06, NFR-06 |
| AC-05.4 | A second submission for the same team and milestone, including two members at the same moment → 409 `ALREADY_SUBMITTED`; one row | BR-07 |
| AC-05.5 | Team members and assigned Supervisors see the persisted submission with submitter and time; other teams, no team, unassigned Supervisors → 404 | FR-14, BR-02, BR-03 |
| AC-05.6 | When the server rejects a submission (deadline passed, duplicate, 5xx or network error), the form shows the server message and keeps the entered values | BR-06, BR-07, NFR-10 |
| AC-05.7 | The submission view shows a loading state while fetching and "Not submitted yet" when the team has no submission | FR-14, NFR-10 |
| AC-05.8 | Team status: Not submitted (none, now ≤ `due_at`), Overdue (none, now > `due_at`), Submitted (has a submission, before and after the deadline) | FR-09, DEC-13 |
| AC-05.9 | A Supervisor submitting → 403; a malformed or invalid body to another team's milestone → 404 (401 → 403 → 404 → 400 → 409) | BR-01, NFR-03 |
| AC-06.1 | An assigned Supervisor records feedback on a submission version → 201 | FR-18, BR-10 |
| AC-06.2 | Feedback text outside 1–2000 chars → 400, and the feedback form shows the field error next to the text box | BR-10, NFR-10 |
| AC-06.3 | Team members see the feedback together with the version it refers to | FR-19 |
| AC-06.4 | A Student recording feedback → 403; an unassigned Supervisor → 404 | BR-01, BR-02 |
| AC-06.5 | The feedback list shows a loading state and "No feedback yet" when empty; the feedback form shows server errors and keeps the text | FR-19, NFR-10 |
| AC-SR1.1 | Validation, auth and not-found errors use `{ "error": { "code", "message" } }` with no stack trace or SQL | NFR-05 |
| AC-SR2.1 | `.env` is git-ignored; `.env.example` lists every variable; the client bundle contains no secret | NFR-12 |
| AC-SR2.2 | Teammate follows the README from a fresh clone to passing tests in ≤ 15 min | NFR-08 |

## Matrix

### Functional requirements

| Req | Feature | Sprint | Verification |
|---|---|---|---|
| FR-01 | F-01 Authentication and session | 1 | AC-01.1, AC-01.2, AC-01.8, AC-01.9 / TEST-01.1, TEST-01.2, TEST-01.8, TEST-01.9 |
| FR-02 | F-01 | 1 | AC-01.4 / TEST-01.4 |
| FR-03 | F-01 | 1 | AC-01.3 / TEST-01.3 |
| FR-04 | F-01 | 1 | AC-01.7 / TEST-01.7 (E2E) |
| FR-05 | [F-03.2 protected team views](sprints/sprint-1/F-03-team-views.md) | 1 | AC-03.3, AC-03.4 / TEST-03.3, TEST-03.4 |
| FR-06 | [F-03.2 protected team views](sprints/sprint-1/F-03-team-views.md) | 1 | AC-03.6, AC-03.7 / TEST-03.6, TEST-03.7 |
| FR-07 | F-07 Team management | 2 | Sprint 2 contract |
| FR-08 | [F-04 Milestones: create and view](sprints/sprint-1/F-04-milestone.md) | 1 | AC-04.1, AC-04.2, AC-04.7 / TEST-04.1i/e, TEST-04.2u/i/c/e, TEST-04.7i |
| FR-09 | F-04 (window, Not submitted / Overdue), F-05 (Submitted) | 1 (S1 rows of §4.3.1), 2 (Late rows, F-08/F-09) | AC-04.3, AC-04.4, AC-04.6, AC-04.8, AC-05.8 / TEST-04.3i/c, TEST-04.4u, TEST-04.6i/c, TEST-04.8i/c, TEST-05.8 |
| FR-10 | F-08 Milestone lifecycle | 2 | Sprint 2 contract |
| FR-11 | F-08 | 2 | Sprint 2 contract |
| FR-12 | F-08 | 2 | Sprint 2 contract |
| FR-13 | F-05 Submit milestone work | 1 | AC-05.1 / TEST-05.1 |
| FR-14 | F-05 | 1 | AC-05.5 / TEST-05.5 |
| FR-15 | F-09 Versioned resubmission | 2 | Sprint 2 contract |
| FR-16 | F-09 | 2 | Sprint 2 contract |
| FR-17 | F-09 | 2 | Sprint 2 contract |
| FR-18 | F-06 Feedback on a submission | 1 | AC-06.1 / TEST-06.1 |
| FR-19 | F-06 | 1 | AC-06.3 / TEST-06.3 |
| FR-20 | F-10 Grades and release | 2 | Sprint 2 contract |
| FR-21 | F-10 | 2 | Sprint 2 contract |
| FR-22 | F-11 Student progress board | 3 | Sprint 3 contract |
| FR-23 | F-12 Supervisor overview and filters | 3 | Sprint 3 contract |
| FR-24 | F-12 | 3 | Sprint 3 contract |
| FR-25 | F-13 CSV export | 3 | Sprint 3 contract |

### Business rules

| Req | Feature / responsibility | Sprint (established → re-verified) | Verification |
|---|---|---|---|
| BR-01 | F-02 (S1 operations); F-07, F-10 extend it | 1 → 2 | AC-02.2, AC-05.9, AC-06.4 / TEST-02.2, TEST-05.9, TEST-06.4; S2 contracts for grades/teams |
| BR-02 | F-02 | 1 → 2, 3 | AC-02.3, AC-03.6, AC-05.5, AC-06.4 / TEST-02.3, TEST-03.6, TEST-05.5, TEST-06.4 |
| BR-03 | F-02 | 1 → 2, 3 | AC-02.4, AC-05.5 / TEST-02.4, TEST-05.5 |
| BR-04 | F-03.1 (DB constraint), F-02 + F-03.2 (API); F-07 (UI) | 1 → 2 | AC-02.4, AC-03.4, AC-03.5 / TEST-02.4b, TEST-03.4, TEST-03.5; Sprint 2 contract |
| BR-05 | F-04 (create); F-08 (extend) | 1 → 2 | AC-04.2 / TEST-04.2; Sprint 2 contract |
| BR-06 | F-05 | 1 → 2 (late window) | AC-05.3 / TEST-05.3 |
| BR-07 | F-05 — **Sprint 1 only**, superseded by BR-08 | 1 | AC-05.4 / TEST-05.4 (replaced in S2) |
| BR-08 | F-09 | 2 | Sprint 2 contract |
| BR-09 | F-05 | 1 | AC-05.2 / TEST-05.2 |
| BR-10 | F-06; F-09 re-verifies feedback stays on its version | 1 → 2 | AC-06.1, AC-06.2 / TEST-06.1, TEST-06.2; Sprint 2 contract |
| BR-11 | F-08 | 2 | Sprint 2 contract |
| BR-12 | F-08 (set window); F-09 (Late marking) | 2 | Sprint 2 contract |
| BR-13 | F-08 | 2 | Sprint 2 contract |
| BR-14 | F-08 | 2 | Sprint 2 contract |
| BR-15 | F-10 | 2 | Sprint 2 contract |
| BR-16 | F-07 | 2 | Sprint 2 contract |

### Non-functional requirements

| Req | Feature / responsibility | Sprint (established → re-verified) | Verification |
|---|---|---|---|
| NFR-01 | F-01, F-03.1 | 1 | AC-01.6, AC-03.2 / TEST-01.6, TEST-03.2 |
| NFR-02 | F-02 (every protected endpoint) | 1 → 2, 3 | AC-02.1 / TEST-02.1, re-run each sprint |
| NFR-03 | F-02 | 1 → 2, 3 | AC-02.2–AC-02.5 / TEST-02.2–TEST-02.5, extended each sprint |
| NFR-04 | F-01 | 1 | AC-01.4, AC-01.5 / TEST-01.4, TEST-01.5 |
| NFR-05 | SR-01 (all features) | 1 → 2, 3 | AC-SR1.1 / TEST-SR1.1, asserted in each feature's API tests |
| NFR-06 | F-04 (display), F-05 (comparison) | 1 | AC-04.3, AC-04.4, AC-05.3 / TEST-04.3, TEST-04.4, TEST-05.3 |
| NFR-07 | SR-03 | 2 (Lab 5) | Persistence check, Issue #22 |
| NFR-08 | SR-02 | 1 (local) → 2 (Docker) | AC-SR2.2 / TEST-SR2.2 (timed manual walkthrough); Docker in #17 |
| NFR-09 | F-12, SR-03 | 3 | Sprint 3 performance script against GCP |
| NFR-10 | Each feature's forms and lists; SR-01 audit | 1 (S1 forms + lists) → 2 (S2 features) → 3 (S3 lists + audit) | **Field errors:** AC-01.8, AC-04.2, AC-05.2, AC-06.2 · **Server errors:** AC-01.8 (401), AC-01.9, AC-04.5, AC-05.6, AC-06.5 · **Loading/empty:** AC-03.7, AC-04.6, AC-05.7, AC-06.5 / matching TEST IDs (E2E). Sprint 2: an NFR-10 AC in each F-07–F-10 contract. Sprint 3: F-11–F-13 lists + SR-01 audit of every form and list (features.md, "UI feedback states") |
| NFR-11 | SR-03 | 2 (Lab 5) | CI required check `test-and-docker`, Issues #18, #20 |
| NFR-12 | SR-02 | 1 (manual) → 2 (CI scan) | AC-03.1, AC-SR2.1 / TEST-03.1, TEST-SR2.1; CI secret scan in Sprint 2 |

## Coverage

| Set | Total | Covered by a feature or responsibility | Verified in Sprint 1 | Allocated to Sprint 2 / 3 |
|---|---|---|---|---|
| FR | 25 | 25 | 12 | 9 / 4 |
| BR | 16 | 16 | 9 (BR-01–07, BR-09, BR-10; BR-07 S1 only) | 7 / 0 |
| NFR | 12 | 12 | 9 | 2 / 1 |

**Uncovered requirements: none.** Every baseline FR, BR and NFR maps to at least one feature or
system responsibility and a sprint.

Partially verified in Sprint 1 (completed later, shown in the matrix):
- **FR-09** — Late rows of §4.3.1 need the late window (F-08) and versions (F-09), Sprint 2.
- **BR-01, BR-02, BR-03, NFR-02, NFR-03** — re-verified as each sprint adds protected endpoints.
- **BR-04** — DB + API in Sprint 1; membership management UI in Sprint 2 (F-07).
- **NFR-10** — Sprint 1 forms and lists in Sprint 1; Sprint 2 features' forms/lists in Sprint 2; Sprint 3
  lists and the all-forms audit in Sprint 3 (features.md, "UI feedback states").
- **NFR-08, NFR-12** — local / manual review in Sprint 1; Docker, CI
  scan later.

Not traced because they are explicitly out of scope: EX-01 – EX-07 (SRS §3.2).

## Approved changes

| Date | Change | Source | Effect on this matrix |
|---|---|---|---|
| 2026-11-03 | A student may have no team | DEC-02 (PR #14 review) | FR-05 / BR-04 gain AC-03.4 (empty state, 404) |
| 2026-11-03 | Separate window and team status; status by deadline, independent of manual close | DEC-13, SRS §4.3.1 (PR #14 review) | FR-09 verified by AC-04.4 boundary tests; Late rows move to Sprint 2 |
| 2026-11-03 | Late window accepts first submission and new versions, all marked Late | DEC-14 (PR #14 review) | FR-15, FR-17, BR-12 → F-09, Sprint 2 |
| 2026-11-03 | NFR-09 measurement method fixed | PR #14 review | NFR-09 → F-12 + SR-03, Sprint 3 |
| 2026-11-03 | Cloud-ready Sprint 1; per-sprint staging branches | DEC-12, DEC-11 | SR-02 / SR-03 established; `/api/health`, `/api/ready` done in #5 |
| planned S2 | BR-07 (one submission) replaced by BR-08 (versions) | DEC-04 | TEST-05.4 retired and replaced by F-09 tests in Sprint 2 |
| 2026-11-03 | Login and feedback validation checked in the UI, not only the API | PR #26 re-review | AC-01.8, AC-01.9 added; AC-06.2 extended; NFR-10 mapping updated |
| 2026-11-03 | F-03 delivered as F-03.1 (data, seed) then F-03.2 (protected team views) | PR #26 review | FR-05, FR-06 and AC-03.3/03.4/03.6/03.7 land after F-02; no dependency cycle |
| 2026-11-03 | NFR-10 server-error and loading/empty checks made explicit | PR #26 review | AC-03.7, AC-04.5, AC-04.6, AC-05.6, AC-05.7, AC-06.5 added; S2/S3 allocation stated |
| 2026-11-04 | 72-byte password limit; fixed 8 h session lifetime | PR #27 review | AC-01.2, AC-01.5, AC-01.6 wording; TEST-01.2d, TEST-01.5c, TEST-01.6c |
| 2026-11-04 | Authorization rules made testable: identical 404 body, check order, malformed IDs | F-02 contract v0.1 (PR review pending) | AC-02.1–AC-02.4 wording; AC-02.5 added; BR-04 also verified by TEST-02.4b |
| 2026-11-04 | JSON parsed per route after the guards (no global parser) | PR #29 review | AC-02.5 wording; TEST-02.1 malformed-body case, TEST-02.5e, TEST-02.5f |
| 2026-11-04 | Submission rules made testable; team status "Submitted" owned by F-05 | F-05 contract v0.1 (PR review pending) | AC-05.1, AC-05.3–AC-05.5 wording; AC-05.8, AC-05.9 added; FR-09 also verified by F-05 |

Later changes are added here with the PR that approved them.
