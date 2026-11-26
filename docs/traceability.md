# Requirements Traceability

**Baseline:** [SRS v0.4](srs.md) · **Features:** [features.md](features.md) · **Changes:** [changes.md](changes.md) · **Issues:** #2, #87 · **Status date:** 2026-11-26 (released `v0.5.0` = `main` `2fde19e`; staging `107b82a`)

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
| 0.9 | 2026-11-05 | @Nuggetkub | @Earth2509 | AC-01.10 added: a 401 during use returns to login with an expiry notice (gap found in PR #32 review); a late 401 from an older session changes nothing (PR #33 review) |
| 0.10 | 2026-11-05 | @Earth2509 | @Nuggetkub | F-04 contract and create/view implementation; AC-04.7 ownership/check order and AC-04.8 pagination added. PR #35 review approved the implementation; v0.9 from merged PR #33 is retained above |
| 0.11 | 2026-11-05 | @Nuggetkub | @Earth2509 | F-05 contract v0.2: AC-05.8 also covers F-04's milestone list and detail (TEST-05.8c) |
| 0.12 | 2026-11-05 | @Nuggetkub | @Earth2509 | F-06 contract v0.1 (taken over from @Earth2509): AC-06.1–AC-06.4 made precise (server-set author/time, trimming, oldest-first list, readers' 404, check order) |
| 0.13 | 2026-11-24 | @Nuggetkub | @Earth2509 | Lab 7 CR-01 (#73): AC-04.2 and BR-05 row use the 24 h minimum due date |
| 0.14 | 2026-11-25 | @Nuggetkub | @Earth2509 | D2 Part D: every AC has an implementation and verification status; Sprint 2 (F-07 to F-10) and Sprint 3 (F-11 to F-13) AC tables; the matrix records requirement → feature → sprint → AC → planned test → actual file → result and version; coverage gaps listed (D-09, D-10) |
| 0.15 | 2026-11-25 | @Nuggetkub | @Earth2509 | PR #99 review: coverage splits fully from partly verified; AC-05.3 qualified for the late window; D-10 resolved for F-08/F-09 (#100); F-10 Grade UI on PR #101 (result set R-101) |
| 0.16 | 2026-11-25 | @Nuggetkub | @Earth2509 | PR #99 re-review: result set R-100 for the run that executed #100's registry cases, cited for AC-02.1, AC-08.7, AC-09.7 and NFR-02; R-102 and D-11 resolved (#102); version rows in order |
| 0.17 | 2026-11-26 | @Nuggetkub | @Earth2509 | `v0.5.0` released and checked on the deployed app: result set R-S3 (release regression and deployed checks D5-00 to D5-12), F-07 to F-10 accepted; F-11 phase 1 integrated (R-S4, #94) with its TEST-02.1 entry (D-10 resolved); coverage recounted |
| 0.18 | 2026-11-26 | @Nuggetkub | @Earth2509 | PR #105 review: D5-12 scoped to what was observed (AC-07.1, AC-07.2, FR-07); registry runs scoped: R-100 is the Sprint 2 routes, R-S4 adds the F-11 progress route (AC-02.1, NFR-02) |

## ID conventions

- **AC-ff.n** — acceptance criterion *n* of feature F-*ff*, defined in that feature's contract
  (`docs/sprints/sprint-N/F-ff-*.md`).
- **TEST-ff.n** — the automated test (or named manual check) that verifies AC-ff.n. Test titles
  start with the ID, e.g. `it("TEST-05.3 rejects a submission one second after due_at", …)`, so
  test output can be matched to this table.
- **AC-SR*n*.m / TEST-SR*n*.m** — the same for a system responsibility SR-*n*.

A contract author may split or renumber AC, and updates this file **in the same PR** as the contract.

### Status columns

- **Impl.** is whether the behaviour exists in code: **Yes**, **In PR** (implemented and green on an open PR, not integrated), **No** (planned) or **Retired**.
- **Verification** names the run in which the AC's tests last executed, using the result sets below. "Planned" means no test has run; an unexecuted test is never counted as passed.

| Result set | Version | What ran | Result |
|---|---|---|---|
| **R-S1** | `v0.4.0` (`aa191ba`), deployed `cpms-00008-l48` | CI on PR #77; local server and client suites; Lab 7 deployed checks L7-D00 to D04 | Server 218/218, client 53/53, deployed checks PASS |
| **R-S2** | `staging/sprint-2` at `4f56155` (F-01 to F-09, F-10 server) | CI run [45603170454](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/45603170454) on #98's head `28d16e7`, whose tree is identical to `4f56155`; local run on `28d16e7` | Server 315/315, client 67/67 (CI and local), both builds pass, E2E 10/10 (local) |
| **R-101** | PR #101 head `6ef3c4f` (F-10 Grade UI and the v0.5 release rule, based on staging `19a9b1d`) | CI run [45633427363](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/45633427363); local Playwright on `c4c86c2` | Server 331/331, client 83/83 (CI and local), both builds pass. E2E: first run 11/12 (TEST-05.1e sign-in timeout, D-11), alone 2/2, full rerun **12/12** |
| **R-100** | PR #100 head `2d9d900` (D-10 registry cases for F-08/F-09), integrated at staging `19a9b1d` | CI run [45613251584](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/45613251584) | Server 329/329 (the 14 new TEST-02.1 cases included), client 67/67, both builds pass |
| **R-102** | PR #102 head `6faee41` (D-11 shared E2E sign-in), integrated at staging `dad3ad0` | CI run [45638408957](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/45638408957); local Playwright | CI server and client suites pass; E2E three consecutive full runs 10/10; a 6 s delayed-login probe fails the old helper and passes the new one |
| **R-S3** | `v0.5.0` = `main` `2fde19e` (#103; staging head `6d9ae96`, identical tree), deployed as revision `cpms-00009-2jg` | Release PR CI [45667044943](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/45667044943) on `6d9ae96`; local regression on `6d9ae96`; deploy run [45744194715](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/45744194715) (migrations, smoke test); deployed checks D5-00 to D5-12 on 26 Nov ([#87](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/87#issuecomment-7192705886)) | Server 331/331, client 83/83 (CI and local), both builds pass, E2E 12/12 (local), no schema drift; smoke test PASS; deployed checks **13/13 PASS** |
| **R-S4** | `staging/sprint-2` at `107b82a` (`v0.5.0` + F-11 phase 1, #94; release `v0.6.0` planned) | CI run [45811793125](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/45811793125) on #94's head `7817401`, whose tree is identical to `107b82a`; local run on `7817401` | Server 346/346, client 89/89 (CI and local), both builds pass, E2E 15/15 (local) |
| **R-94** | PR #94 head `3b72786` (F-11 phase 1, based on staging `2d5364e`) | CI run [45586183430](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/45586183430); local Playwright | Server 260/260, client 69/69, E2E 12/12 |

No test in these sets was skipped. The one failure is disclosed in R-101 (flaky TEST-05.1e sign-in wait, D-11, passed on rerun; fixed by #102, R-102). R-S2 holds the feature-level results. R-100 is the run that executed the registry with every Sprint 2 protected route (before F-11); R-S4 is the first run with the F-11 route `GET /api/teams/:teamId/progress` in it, so R-S4 covers the full registry for everything integrated. R-S3 is the accepted Sprint 2 release: the full regression on the release commit plus the deployed checks; D5-xx IDs refer to those checks.

## Sprint 1 acceptance criteria

All Sprint 1 AC are implemented and released (`v0.3.0`, accepted by StudyTrack UAT; `v0.4.0`).

| AC | Criterion | Requirements | Impl. | Verification |
|---|---|---|---|---|
| AC-01.1 | Valid email + password → 200 `{ token, user: { id, name, email, role } }` and a DB session row | FR-01 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-01.2 | Wrong password or unknown email → 401 with the same message (no account enumeration); a password over 72 UTF-8 bytes → 400 on `password` | FR-01, NFR-05 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-01.3 | `GET /api/auth/me` with a valid token → the caller's id, name, email, role | FR-03 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-01.4 | After `POST /api/auth/logout`, the same token → 401 | FR-02, NFR-04 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-01.5 | A session is rejected after 8 h (expiry computed at login); the 8 h is fixed in code, not configurable | NFR-04 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-01.6 | Stored password is a bcrypt hash (cost ≥ 10); passwords over 72 UTF-8 bytes are refused, never truncated; no response contains a `password`/`passwordHash` field | NFR-01 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-01.7 | After login the UI shows Student or Supervisor navigation; logout returns to the login page | FR-04 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-01.8 | The Login form shows field-level messages for a missing or malformed email and a missing password, without sending the request; on a 401 it shows one generic message ("Email or password is incorrect") that is the same for wrong password and unknown email | FR-01, NFR-10 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-01.9 | When login fails on the server (5xx or network error), the Login form shows a visible error, keeps the email, clears the password and lets the user retry | FR-01, NFR-10 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-01.10 | When a signed-in user's session expires or is revoked during use, the next API request's 401 returns them to the login page with "Your session has expired. Please sign in again." and the token is cleared; no page shows its own error for it. A late 401 for a token that is no longer the current one (signed in again, or logged out) changes nothing | FR-03, NFR-04, NFR-10 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-02.1 | Every protected endpoint (listed in the protected-endpoint test list) without a valid token → 401, no data | NFR-02 | Yes | PASS R-S1, R-S2, R-S3. Registry with every Sprint 2 route: R-100 (and R-S3). Registry including the F-11 progress route: R-S4 |
| AC-02.2 | A Student calling a Supervisor-only operation (even for their own team), or a Supervisor calling a Student-only operation → 403 | BR-01, NFR-03 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-02.3 | A Supervisor reading or acting on an unassigned team's records → 404, identical to a nonexistent record; every assigned supervisor passes | BR-02, NFR-03 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-02.4 | A Student reading another team's records, or a Student with no team → 404, identical to a nonexistent record, no data | BR-03, BR-04, NFR-03 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-02.5 | Malformed or out-of-range IDs → 404 (never 500); checks run in the order 401 → 403 → 404 → 400, including malformed JSON bodies | NFR-03, NFR-05 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-03.1 | **[F-03.1]** `npm run prisma:seed` creates demo supervisors, students and teams; a second run creates no duplicates; passwords come from env | AS-01, NFR-12 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-03.2 | **[F-03.1]** Seeded users' `password_hash` values are bcrypt hashes | NFR-01 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-03.3 | **[F-03.2]** A Student sees their team name, members and assigned supervisors | FR-05 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-03.4 | **[F-03.2]** An unassigned Student sees "You are not assigned to a team yet"; team-scoped requests → 404 | FR-05, BR-04 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-03.5 | **[F-03.1]** The DB rejects a second team membership for the same student | BR-04 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-03.6 | **[F-03.2]** A Supervisor's team list contains only their assigned teams | FR-06, BR-02 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-03.7 | **[F-03.2]** Team view and team list show a loading state while fetching; a Supervisor with no teams sees "No teams assigned yet" | FR-06, NFR-10 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-04.1 | A Supervisor creates a milestone for an assigned team → 201, persisted | FR-08 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-04.2 | Title outside 1–120 chars or due date earlier than server now + 24 h (CR-01) → 400 with field errors shown in the form; exactly now + 24 h is accepted | BR-05, NFR-10 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-04.3 | A Student sees their team's milestones with due date in Asia/Bangkok time, window and team status | FR-09, NFR-06 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-04.4 | Window and team status follow SRS §4.3.1 Sprint 1 rows at `due_at − 1 s`, `due_at`, `due_at + 1 s` | FR-09, NFR-06 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-04.5 | When creating a milestone fails on the server (5xx or network error), the form shows the error message, keeps the entered values and allows a retry | NFR-10 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-04.6 | The milestone list shows a loading state while fetching and "No milestones yet" when empty | FR-09, NFR-10 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-04.7 | Supervisor-only create, team-scoped list/detail and identical hidden/missing 404; malformed JSON cannot outrank 401/403/404 | BR-01–BR-04, NFR-02, NFR-03, NFR-05 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-04.8 | Team milestone list paginates 50 rows by dueAt ASC/id ASC; team changes cannot show stale prior-team results | FR-09, NFR-10 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-05.1 | A Student of the milestone's team submits title, description, link while the window is Open → 201, persisted as version 1 with submitter and server time | FR-13 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-05.2 | Invalid title/description/link → 400 with field errors shown in the form | BR-09, NFR-10 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-05.3 | Submission at `due_at − 1 s` and at `due_at` accepted; at `due_at + 1 s` **when no late window is open** → 409 `DEADLINE_PASSED` (server clock; client times ignored). From Sprint 2, a submission inside an open late window is accepted and marked Late (AC-09.2) | BR-06, NFR-06 | Yes | PASS R-S1, R-S2, R-S3. Late-window acceptance: TEST-09.2i; rejection outside it: TEST-09.3i (both R-S2) |
| AC-05.4 | A second submission for the same team and milestone, including two members at the same moment → 409 `ALREADY_SUBMITTED`; one row | BR-07 | Retired | BR-07 retired by BR-08 (F-09). TEST-05.4a/b replaced by TEST-09.1i and TEST-09.6i |
| AC-05.5 | Team members and assigned Supervisors see the persisted submission with submitter and time; other teams, no team, unassigned Supervisors → 404 | FR-14, BR-02, BR-03 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-05.6 | When the server rejects a submission (deadline passed, duplicate, 5xx or network error), the form shows the server message and keeps the entered values | BR-06, BR-07, NFR-10 | Yes | PASS R-S1; R-S2, R-S3 with F-09's revised TEST-05.6 (form returns as "Submit a new version") |
| AC-05.7 | The submission view shows a loading state while fetching and "Not submitted yet" when the team has no submission | FR-14, NFR-10 | Yes | PASS R-S1; R-S2, R-S3 with F-09's revised TEST-05.7 |
| AC-05.8 | Team status: Not submitted (none, now ≤ `due_at`), Overdue (none, now > `due_at`), Submitted (has a submission, before and after the deadline), on the milestone page and in F-04's list and detail | FR-09, DEC-13 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-05.9 | A Supervisor submitting → 403; a malformed or invalid body to another team's milestone → 404 (401 → 403 → 404 → 400 → 409) | BR-01, NFR-03 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-06.1 | An assigned Supervisor (or co-supervisor) records feedback on a submission version → 201; author, time and submission come from the session, server clock and URL | FR-18, BR-10 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-06.2 | Feedback text outside 1–2000 characters after trimming → 400 `fields.text`, no row; the feedback form checks it before sending and shows the field error next to the text box | BR-10, NFR-10 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-06.3 | Team members and assigned Supervisors see every feedback entry, oldest first, with author, Bangkok time and the version it refers to | FR-19 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-06.4 | A Student recording feedback → 403; an unassigned Supervisor → 404; other teams' Students and Students with no team reading it → 404; order 401 → 403 → 404 → 400 | BR-01, BR-02, BR-03 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-06.5 | The feedback list shows a loading state and "No feedback yet" when empty; the feedback form shows server errors and keeps the text | FR-19, NFR-10 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-SR1.1 | Validation, auth and not-found errors use `{ "error": { "code", "message" } }` with no stack trace or SQL | NFR-05 | Yes | PASS R-S1, R-S2, R-S3 |
| AC-SR2.1 | `.env` is git-ignored; `.env.example` lists every variable; the client bundle contains no secret | NFR-12 | Yes | PASS manual TEST-SR2.1 at `v0.1.0` (D1 Part F, 6 Nov). The CI secret scan planned for Sprint 2 is missing (D-09) |
| AC-SR2.2 | Teammate follows the README from a fresh clone to passing tests in ≤ 15 min | NFR-08 | Yes | PASS manual TEST-SR2.2 at `v0.1.0` (D1 Part F; time met, one deviation). Re-run planned before Final |

## Sprint 2 acceptance criteria

Full wording, inputs and expected results are in each contract. Sprint 2 is **accepted**: F-07 to F-10 were released as `v0.5.0` on 26 Nov 2026. Every AC below passed again in the release regression (R-S3), and the deployed checks named in a row ran on the live app.

| AC | Criterion (short) | Requirements | Planned tests → actual file | Impl. | Verification |
|---|---|---|---|---|---|
| AC-07.1 | Create a team: one team and one creator assignment; no orphans on any failure | FR-07, BR-01 | TEST-07.1u, 07.1i, 07.1e → `server/tests/team-management-units.test.ts`, `team-management.test.ts`, `e2e/team-management.spec.ts` | Yes | PASS R-S2, R-S3; deployed D5-12 (team created, empty roster, Student search and picker; no Student added) |
| AC-07.2 | Roster and add an unassigned Student; no transfer or second membership | FR-07, BR-02, BR-04 | TEST-07.2i, 07.2bi → `team-management.test.ts` | Yes | PASS R-S2, R-S3: adding an unassigned Student and the no-transfer / no-second-membership rules are verified by TEST-07.2i and TEST-07.2bi. Deployed D5-12 shows only the roster and the Student search and picker on a new team; no seeded Student was added |
| AC-07.3 | Remove a member without authored work; they see the no-team state and 404s | FR-07, BR-03, BR-04, BR-16 | TEST-07.3i → `team-management.test.ts` | Yes | PASS R-S2, R-S3 |
| AC-07.4 | Removing an author (any version) → 409; removal and submission can't both succeed | BR-16 | TEST-07.4i, 07.4bi (sequential, concurrent and **held lock**) → `team-management.test.ts` | Yes | PASS R-S2, R-S3. Held-lock cases fail with the lock removed (D-04) |
| AC-07.5 | 401 → 403 → 404 before validation; denied writes change nothing | BR-01–BR-03, NFR-03, NFR-05 | TEST-07.5i → `team-management.test.ts`; routes in the TEST-02.1 registry | Yes | PASS R-S2, R-S3 |
| AC-07.6 | UI loading, empty, validation and retryable errors; no Student controls | FR-07, NFR-10 | TEST-07.6c, 07.1e → `client/tests/team-management.test.tsx`, `e2e/team-management.spec.ts` | Yes | PASS R-S2, R-S3 |
| AC-08.1 | Edit title and description; dates unchanged | FR-10 | TEST-08.1i, 08.1e → `server/tests/milestones-lifecycle.test.ts`, `e2e/lifecycle.spec.ts` | Yes | PASS R-S2, R-S3 |
| AC-08.2 | Extend only (BR-13) and at least now + 24 h (CR-01); no write on 400 | FR-10, BR-13, BR-05 | TEST-08.2u, 08.2i, 08.10i → `milestones-lifecycle-units.test.ts`, `milestones-lifecycle.test.ts`, `milestones-concurrency.test.ts` | Yes | PASS R-S2, R-S3 |
| AC-08.3 | Late window after the due date and in the future; `null` removes it | FR-12, BR-12 | TEST-08.2u, 08.3i, 08.10i → same files | Yes | PASS R-S2, R-S3 |
| AC-08.4 | Close: `closedAt`/`closedBy` set; second close 409; dates locked | FR-11 | TEST-08.4i → `milestones-lifecycle.test.ts` | Yes | PASS R-S2, R-S3; deployed D5-05 |
| AC-08.5 | Window rows at due − 1 s, due, due + 1 ms, late_until, + 1 ms, closed | DEC-13, §4.3.1 | TEST-08.5u → `milestones-lifecycle-units.test.ts` | Yes | PASS R-S2, R-S3 |
| AC-08.6 | Submitting to a closed milestone → 409 `MILESTONE_CLOSED`, no row | BR-11 | TEST-08.6i, 08.9i, 08.10i → `milestones-lifecycle.test.ts`, `milestones-concurrency.test.ts` | Yes | PASS R-S2, R-S3. Race tests fail on unlocked code (D-01); deployed D5-06 (UI) |
| AC-08.7 | Guard order; `DELETE` → 404 and the row stays | BR-01–BR-03, BR-14, NFR-02, NFR-03, NFR-05 | TEST-08.7i → `milestones-lifecycle.test.ts`; both routes in the TEST-02.1 registry (#100) | Yes | PASS R-S2, R-S3 (TEST-08.7i); registry cases R-100 |
| AC-08.8 | Supervisor detail page: busy, field errors, retry, close confirmation | NFR-10 | TEST-08.8c, 08.1e → `client/tests/milestone-manage.test.tsx`, `e2e/lifecycle.spec.ts` | Yes | PASS R-S2, R-S3 |
| AC-09.1 | New version N+1 while Open; earlier versions unchanged | FR-15, BR-08 | TEST-09.1i, 09.1e → `server/tests/resubmission.test.ts`, `e2e/resubmission.spec.ts` | Yes | PASS R-S2, R-S3; deployed D5-03 |
| AC-09.2 | Late window: first submission and new versions marked Late; boundary at `lateUntil` | FR-17, BR-12, DEC-14 | TEST-09.2u, 09.2i → `resubmission-units.test.ts`, `resubmission.test.ts` | Yes | PASS R-S2, R-S3 |
| AC-09.3 | Closed or deadline passed → 409, no row | BR-11, BR-06 | TEST-09.3i → `resubmission.test.ts` | Yes | PASS R-S2, R-S3 |
| AC-09.4 | History newest first for team and assigned Supervisors; fixed 404 for others | FR-16, BR-02, BR-03 | TEST-09.4i, 09.8c, 09.1e → `resubmission.test.ts`, `client/tests/resubmission.test.tsx`, `e2e/resubmission.spec.ts` | Yes | PASS R-S2, R-S3; deployed D5-03, D5-04 |
| AC-09.5 | Feedback stays on its version; team status follows the latest version | BR-10, DEC-13 | TEST-09.5i, 09.2u → `resubmission.test.ts`, `resubmission-units.test.ts` | Yes | PASS R-S2, R-S3 |
| AC-09.6 | Simultaneous submits get consecutive versions; 409 only after 3 collisions | BR-08 | TEST-09.6u, 09.6i → `resubmission-units.test.ts`, `resubmission.test.ts` | Yes | PASS R-S2, R-S3. Only the version index is retried (D-03) |
| AC-09.7 | 401 → 403 → 404 → 400; no write | NFR-02, NFR-03, NFR-05 | TEST-09.7i → `resubmission.test.ts`; history route in the TEST-02.1 registry (#100) | Yes | PASS R-S2, R-S3 (TEST-09.7i); registry cases R-100 |
| AC-09.8 | New-version form, Late notice, no form when Closed, history with badges | NFR-10 | TEST-09.8c → `client/tests/resubmission.test.tsx` | Yes | PASS R-S2, R-S3 |
| AC-10.1 | Save a 0–100 draft; one row; allowed with no submission and in any window | FR-20, FR-21, BR-15 | TEST-10.1u, 10.1i, 10.1bi, 10.1ci (DB checks), 10.1e → `server/tests/grades-units.test.ts`, `grades.test.ts`, `grades-concurrency.test.ts`, `e2e/grades.spec.ts` | Yes | PASS R-S2, R-101, R-S3; deployed D5-07 |
| AC-10.2 | Students get the same minimal response until release; then the score | FR-21, BR-03, BR-15, DEC-06 | TEST-10.1u, 10.2i, 10.1e → `grades-units.test.ts`, `grades.test.ts`, `e2e/grades.spec.ts` | Yes | PASS R-S2 (byte-identical pre-release body), R-101, R-S3; deployed D5-07, D5-08 |
| AC-10.3 | New draft after release stays private; repeat release keeps the record; save/release race is coherent; a release confirmed for an older draft is refused | FR-20, FR-21, BR-15 | TEST-10.3i, 10.3bi (held lock), 10.3di (two Supervisors) → `grades.test.ts`, `grades-concurrency.test.ts` | Yes | PASS R-101, R-S3 (v0.5 rule); deployed D5-08 |
| AC-10.4 | 401 / 403 / masked 404 before validation; no change | BR-01–BR-03, NFR-03, NFR-05, DEC-10 | TEST-10.4i → `grades.test.ts`; routes in the TEST-02.1 registry | Yes | PASS R-S2, R-S3; deployed D5-10 (403), D5-11 (404) |
| AC-10.5 | Grade section states; only Supervisors see actions; release only the confirmed draft; malformed responses never rendered | FR-20, FR-21, NFR-10 | TEST-10.5c, 10.1e (two journeys) → `client/tests/grade.test.tsx`, `e2e/grades.spec.ts` | Yes | PASS R-101, R-S3; deployed D5-07, D5-08 |

## Sprint 3 acceptance criteria

| AC | Criterion (short) | Requirements | Planned tests → actual file | Impl. | Verification |
|---|---|---|---|---|---|
| AC-11.1 | One row per own-team milestone, in due order, same window and team status as F-04 | FR-22, DEC-13 | TEST-11.1i, 11.1e → `server/tests/progress.test.ts`, `e2e/progress.spec.ts` | Yes | PASS R-94, R-S4 |
| AC-11.2 | Latest version and its own feedback status: AWAITING, then RECEIVED | FR-22, BR-10 | TEST-11.2u, 11.2i → `progress-units.test.ts`, `progress.test.ts` | Yes | PASS R-94, R-S4 |
| AC-11.3 | Released grade only after release; no `score` key before (phase 2) | FR-22, BR-15, DEC-06 | TEST-11.3u, 11.3i → not written (needs F-10) | No | Planned |
| AC-11.4 | 401 then the fixed 404 for hidden or missing scope, also inside the snapshot | BR-03, BR-04, NFR-03 | TEST-11.4i, 11.4bi → `progress.test.ts` | Yes | PASS R-94, R-S4. Route added to the TEST-02.1 registry (`c24db4b`, D-10 resolved) |
| AC-11.5 | 50 + 1 rows in dueAt/id order; invalid page → 400 after ownership | NFR-09, NFR-10 | TEST-11.5i → `progress.test.ts` | Yes | PASS R-94, R-S4 |
| AC-11.6 | Loading, empty, error with Retry, no-team; no horizontal overflow | NFR-10 | TEST-11.6c, 11.6e → `client/tests/progress.test.tsx`, `e2e/progress.spec.ts` | Yes | PASS R-94, R-S4 |
| AC-12.1 | Scoped overview rows with submission and feedback states | FR-23, BR-02, DEC-13 | TEST-12.1u, 12.1i, 12.1e | No | Planned (Final) |
| AC-12.2 | Team and state filters, combined | FR-24 | TEST-12.2i, 12.1e | No | Planned (Final) |
| AC-12.3 | 403 / 401 / fixed 404 / 400 for bad callers and filters | BR-02, NFR-03, NFR-05 | TEST-12.3i | No | Planned (Final) |
| AC-12.4 | NFR-09 p95 < 500 ms on Cloud Run | NFR-09 | TEST-12.4p | No | Planned (Final) |
| AC-12.5 | UI states; no stale replacement; filters in the URL | NFR-10 | TEST-12.5c | No | Planned (Final) |
| AC-13.1 | CSV rows equal all Overview pages for the same filters | FR-25, BR-02, DEC-05 | TEST-13.1i, 13.1e | No | Planned (Final) |
| AC-13.2 | Only published grades; 0 kept | FR-25, BR-15, DEC-06 | TEST-13.2i | No | Planned (Final) |
| AC-13.3 | Errors as F-12; header-only empty CSV; oversized → 400 | BR-02, NFR-03, NFR-05, DEC-10 | TEST-13.3i, 13.3u | No | Planned (Final) |
| AC-13.4 | Thai, quoting and formula-safe text | FR-25 | TEST-13.4u | No | Planned (Final) |
| AC-13.5 | Download keeps filters on failure; no Student control | FR-25, NFR-10 | TEST-13.5c, 13.1e | No | Planned (Final) |

## Matrix

Columns follow D2 Part D: requirement → feature or responsibility → sprint → AC or NFR verification → planned test → actual file/test → result and version. Server files are under `server/tests/`, client files under `client/tests/` and journeys under `e2e/`.

### Functional requirements

| Req | Feature | Sprint | AC | Planned test | Actual file / test | Result and version |
|---|---|---|---|---|---|---|
| FR-01 | F-01 | 1 | AC-01.1, 01.2, 01.8, 01.9 | TEST-01.1, 01.2a–d, 01.8a/b, 01.9 | `auth.test.ts`, `auth-units.test.ts`; `auth.test.tsx`; `auth.spec.ts` | PASS R-S1, R-S2, R-S3 |
| FR-02 | F-01 | 1 | AC-01.4 | TEST-01.4, 01.4b | `auth.test.ts` | PASS R-S1, R-S2, R-S3 |
| FR-03 | F-01 | 1 | AC-01.3, 01.10 | TEST-01.3, 01.10a–c | `auth.test.ts`; `auth.test.tsx`, `api.test.ts` | PASS R-S1, R-S2, R-S3 |
| FR-04 | F-01 | 1 | AC-01.7 | TEST-01.7a/b | `auth.test.tsx`; `auth.spec.ts` | PASS R-S1, R-S2, R-S3 |
| FR-05 | F-03.2 | 1 | AC-03.3, 03.4 | TEST-03.3, 03.3c, 03.4, 03.4c | `team-views.test.ts`; `team-views.test.tsx` | PASS R-S1, R-S2, R-S3 |
| FR-06 | F-03.2 | 1 | AC-03.6, 03.7 | TEST-03.6, 03.6c, 03.7, 03.7c | `team-views.test.ts`; `team-views.test.tsx` | PASS R-S1, R-S2, R-S3 |
| FR-07 | F-07 | 2 | AC-07.1–07.3, 07.6 | TEST-07.1u/i/e, 07.2i/bi, 07.3i, 07.6c | `team-management(-units).test.ts`; `team-management.test.tsx`; `team-management.spec.ts` | PASS R-S2, R-S3; deployed D5-12 (team created, empty roster, Student search and picker; no Student added) |
| FR-08 | F-04 | 1 | AC-04.1, 04.2, 04.7 | TEST-04.1i/e, 04.2u/i/c/e, 04.7i | `milestones(-units).test.ts`; `milestones.test.tsx`; `milestones.spec.ts` | PASS R-S1, R-S2, R-S3 |
| FR-09 | F-04, F-05; F-08, F-09 (Late rows) | 1 → 2 | AC-04.3, 04.4, 04.6, 04.8, 05.8, 08.5, 09.2, 09.5 | TEST-04.3i/c, 04.4u, 04.6i/c, 04.8i/c, 05.8a–c, 08.5u, 09.2u/i, 09.5i | `milestones-units.test.ts`, `milestones.test.ts`, `submissions.test.ts`, `milestones-lifecycle-units.test.ts`, `resubmission(-units).test.ts`; `milestone-time.test.ts`, `milestones.test.tsx` | PASS R-S2, R-S3 (S1 rows also R-S1) |
| FR-10 | F-08 | 2 | AC-08.1, 08.2, 08.8 | TEST-08.1i/e, 08.2u/i, 08.8c | `milestones-lifecycle(-units).test.ts`; `milestone-manage.test.tsx`; `lifecycle.spec.ts` | PASS R-S2, R-S3 |
| FR-11 | F-08 | 2 | AC-08.4, 08.6 | TEST-08.4i, 08.6i, 08.9i, 08.10i | `milestones-lifecycle.test.ts`, `milestones-concurrency.test.ts` | PASS R-S2, R-S3 |
| FR-12 | F-08 | 2 | AC-08.3 | TEST-08.2u, 08.3i, 08.10i | `milestones-lifecycle(-units).test.ts`, `milestones-concurrency.test.ts` | PASS R-S2, R-S3 |
| FR-13 | F-05 | 1 | AC-05.1 | TEST-05.1, 05.1b, 05.1e | `submissions.test.ts`; `submission.test.tsx`; `submissions.spec.ts` | PASS R-S1, R-S2, R-S3 |
| FR-14 | F-05 | 1 | AC-05.5 | TEST-05.5a/b | `submissions.test.ts` | PASS R-S1, R-S2, R-S3 |
| FR-15 | F-09 | 2 | AC-09.1 | TEST-09.1i/e | `resubmission.test.ts`; `resubmission.spec.ts` | PASS R-S2, R-S3 |
| FR-16 | F-09 | 2 | AC-09.4 | TEST-09.4i, 09.8c, 09.1e | `resubmission.test.ts`; `resubmission.test.tsx`; `resubmission.spec.ts` | PASS R-S2, R-S3 |
| FR-17 | F-09 | 2 | AC-09.2 | TEST-09.2u/i | `resubmission(-units).test.ts` | PASS R-S2, R-S3 |
| FR-18 | F-06 | 1 | AC-06.1, 06.2 | TEST-06.1, 06.2a–d, 06.1e | `feedback.test.ts`, `feedback-validate.test.ts`; `feedback.test.tsx`; `feedback.spec.ts` | PASS R-S1, R-S2, R-S3 |
| FR-19 | F-06 | 1 | AC-06.3, 06.5 | TEST-06.3, 06.5a–c, 06.1e | `feedback.test.ts`; `feedback.test.tsx`; `feedback.spec.ts` | PASS R-S1, R-S2, R-S3 |
| FR-20 | F-10 | 2 | AC-10.1, 10.3, 10.5 | TEST-10.1u/i/bi/ci, 10.3i/bi/di; 10.5c, 10.1e | `grades(-units/-concurrency).test.ts`; `grade.test.tsx`; `grades.spec.ts` | PASS R-S2, R-101, R-S3; deployed D5-07, D5-08 |
| FR-21 | F-10 | 2 | AC-10.2, 10.3 | TEST-10.1u, 10.2i, 10.3i/bi/di; 10.1e | `grades(-units/-concurrency).test.ts`; `grades.spec.ts` | PASS R-S2, R-101, R-S3; deployed D5-07, D5-08, D5-10, D5-11 |
| FR-22 | F-11 | 3 | AC-11.1, 11.2, 11.5, 11.6 (phase 1); AC-11.3 (phase 2) | TEST-11.1i/e, 11.2u/i, 11.5i, 11.6c/e; 11.3u/i | `progress(-units).test.ts`; `progress.test.tsx`; `progress.spec.ts` | **Partly verified**: phase 1 PASS R-94, R-S4 (integrated; deployed check with `v0.6.0`); AC-11.3 **planned** |
| FR-23 | F-12 | 3 | AC-12.1 | TEST-12.1u/i/e | Not written | **Planned** (Final) |
| FR-24 | F-12 | 3 | AC-12.2, 12.5 | TEST-12.2i, 12.5c, 12.1e | Not written | **Planned** (Final) |
| FR-25 | F-13 | 3 | AC-13.1–13.5 | TEST-13.1i/e, 13.2i, 13.3i/u, 13.4u, 13.5c | Not written | **Planned** (Final) |

### Business rules

| Req | Feature / responsibility | Sprint | AC | Planned test | Actual file / test | Result and version |
|---|---|---|---|---|---|---|
| BR-01 | F-02; extended by F-07, F-08, F-09, F-10 | 1 → 2 | AC-02.2, 05.9, 06.4, 07.5, 08.7, 09.7, 10.4 | TEST-02.2a–c, 05.9a/b, 06.4a–c, 07.5i, 08.7i, 09.7i, 10.4i | `authz.test.ts`, `submissions.test.ts`, `feedback.test.ts`, `team-management.test.ts`, `milestones-lifecycle.test.ts`, `resubmission.test.ts`, `grades.test.ts` | PASS R-S2, R-S3 |
| BR-02 | F-02; each team-scoped feature | 1 → 2, 3 | AC-02.3, 03.6, 05.5, 06.4, 07.2, 07.5, 08.7, 09.4; 11.4; 12.3 | TEST-02.3a–c, 03.6, 05.5a/b, 06.4a–c, 07.2i, 07.5i, 08.7i, 09.4i; 11.4i; 12.3i | as BR-01, plus `team-views.test.ts`; `progress.test.ts` | PASS R-S2, R-S3; F-11 PASS R-94; F-12 **planned** |
| BR-03 | F-02; each team-scoped feature | 1 → 2, 3 | AC-02.4, 05.5, 07.3, 09.4, 11.4 | TEST-02.4a–d, 05.5a/b, 07.3i, 09.4i, 11.4i, 11.4bi | `authz.test.ts`, `submissions.test.ts`, `team-management.test.ts`, `resubmission.test.ts`; `progress.test.ts` | PASS R-S2, R-S3; F-11 PASS R-94 |
| BR-04 | F-03.1 (DB), F-02, F-03.2; F-07 (UI) | 1 → 2 | AC-02.4, 03.4, 03.5, 07.2, 07.3 | TEST-02.4b, 03.4, 03.5, 07.2i/bi, 07.3i | `authz.test.ts`, `team-views.test.ts`, `demo-seed.test.ts`, `team-management.test.ts` | PASS R-S2, R-S3 |
| BR-05 | F-04 (create), F-08 (extend) | 1 → 2; CR-01 | AC-04.2, 08.2 | TEST-04.2u/i/c/e, 08.2u/i | `milestones-units.test.ts`, `milestones.test.ts`, `milestones.test.tsx`, `milestones.spec.ts`, `milestones-lifecycle(-units).test.ts` | PASS R-S1 (CR-01), R-S2, R-S3 |
| BR-06 | F-05; F-09 | 1 → 2 | AC-05.3, 09.3 | TEST-05.3a/b/e, 09.3i | `submissions.test.ts`, `submissions-units.test.ts`, `submissions.spec.ts`, `resubmission.test.ts` | PASS R-S2, R-S3 |
| BR-07 | F-05 (Sprint 1 only) | 1 | AC-05.4 | TEST-05.4a/b | Retired in `submissions.test.ts` (comment) | **Retired** by BR-08 (DEC-04); not a gap |
| BR-08 | F-09 | 2 | AC-09.1, 09.6 | TEST-09.1i, 09.6u/i | `resubmission(-units).test.ts` | PASS R-S2, R-S3 |
| BR-09 | F-05 | 1 | AC-05.2 | TEST-05.2a–d | `submissions-validate.test.ts`, `submissions.test.ts`, `submission.test.tsx` | PASS R-S1, R-S2, R-S3 |
| BR-10 | F-06; F-09 | 1 → 2 | AC-06.1, 06.2, 09.5 | TEST-06.1, 06.2a–d, 09.5i | `feedback(-validate).test.ts`, `feedback.test.tsx`, `resubmission.test.ts` | PASS R-S2, R-S3 |
| BR-11 | F-08; F-09 | 2 | AC-08.6, 09.3 | TEST-08.6i, 08.9i, 08.10i, 09.3i | `milestones-lifecycle.test.ts`, `milestones-concurrency.test.ts`, `resubmission.test.ts` | PASS R-S2, R-S3 |
| BR-12 | F-08 (window); F-09 (Late) | 2 | AC-08.3, 09.2 | TEST-08.2u, 08.3i, 09.2u/i | `milestones-lifecycle(-units).test.ts`, `resubmission(-units).test.ts` | PASS R-S2, R-S3 |
| BR-13 | F-08 | 2 | AC-08.2 | TEST-08.2u/i | `milestones-lifecycle(-units).test.ts` | PASS R-S2, R-S3 |
| BR-14 | F-08 | 2 | AC-08.7 | TEST-08.7i (`DELETE` → 404, row kept) | `milestones-lifecycle.test.ts` | PASS R-S2, R-S3 |
| BR-15 | F-10; F-11 phase 2; F-13 | 2 → 3 | AC-10.1–10.3; 11.3; 13.2 | TEST-10.1u/ci, 10.2i, 10.3i/bi; 11.3u/i; 13.2i | `server/tests/grades-units.test.ts`, `grades.test.ts`, `grades-concurrency.test.ts` | F-10 PASS R-S2, R-S3; deployed D5-07, D5-08. F-11 phase 2 and F-13 **planned**; F-11 phase 1 returns no grade at all (TEST-11.1i) |
| BR-16 | F-07 | 2 | AC-07.3, 07.4 | TEST-07.3i, 07.4i, 07.4bi (held lock) | `team-management.test.ts` | PASS R-S2, R-S3 |

### Non-functional requirements

| Req | Feature / responsibility | Sprint | AC or verification | Planned test | Actual file / test or measurement | Result and version |
|---|---|---|---|---|---|---|
| NFR-01 | F-01, F-03.1 | 1 | AC-01.6, 03.2 | TEST-01.6a–c, 03.2 | `auth.test.ts`, `auth-units.test.ts`, `demo-seed.test.ts` | PASS R-S1, R-S2, R-S3 |
| NFR-02 | F-02 (every protected endpoint) | 1 → 2, 3 | AC-02.1; each feature's 401 case | TEST-02.1 over `support/protected-endpoints.ts`; TEST-07.5i, 08.7i, 09.7i, 10.4i, 11.4i | `authz.test.ts`; feature files | PASS R-S2 (feature-level 401 cases); R-100 and R-S3: every Sprint 2 route in the registry (F-08/F-09 added by #100); R-S4: the registry with the F-11 route (`c24db4b`), so D-10 is resolved |
| NFR-03 | F-02; each feature | 1 → 2, 3 | AC-02.2–02.5, 07.5, 08.7, 09.7, 10.4, 11.4 | TEST-02.2–02.5, 07.5i, 08.7i, 09.7i, 10.4i, 11.4i/bi | `authz.test.ts`, feature files | PASS R-S2, R-S3, R-94; F-12 **planned** |
| NFR-04 | F-01 | 1 | AC-01.4, 01.5, 01.10 | TEST-01.4, 01.5a–c, 01.10a–c | `auth.test.ts`, `auth-units.test.ts`, `auth.test.tsx` | PASS R-S1, R-S2, R-S3 |
| NFR-05 | SR-01 | 1 → 2, 3 | AC-SR1.1; error bodies in every feature | TEST-SR1.1 and each feature's 400/404/409 assertions | `auth.test.ts`, feature files | PASS R-S2, R-S3, R-94 |
| NFR-06 | F-04, F-05; F-08, F-09 | 1 → 2 | AC-04.3, 04.4, 05.3, 08.5, 09.2 | TEST-04.4u, 05.3a/b, 08.5u, 09.2i | `milestones-units.test.ts`, `submissions.test.ts`, `milestones-lifecycle-units.test.ts`, `resubmission.test.ts`, `milestone-time.test.ts` | PASS R-S2, R-S3 |
| NFR-07 | SR-03 | 2 (Lab 5) | Create → redeploy → read back | Post-deployment check | Lab 5 #22; L7-D02 (created on `v0.4.0`, read back) | PASS on `v0.4.0` (L7-D02) and on `v0.5.0`: D5-01 reads back the Lab 7 milestone after the `v0.5.0` deploy and migrations, D5-09 reads back F-09/F-10 data in a new session (R-S3). **Planned** again on `v0.6.0` |
| NFR-08 | SR-02 | 1 → 2 | AC-SR2.2 | Timed walkthrough | D1 Part F (`v0.1.0`); Docker in #17 | PASS at `v0.1.0`. **Planned** re-run before Final |
| NFR-09 | F-12, SR-03 | 3 | AC-12.4 | TEST-12.4p (scaled seed, Cloud Run) | Not run | **Planned** (Final); uncovered at D2 |
| NFR-10 | Each feature; SR-01 audit | 1 → 2 → 3 | Field: AC-01.8, 04.2, 05.2, 06.2, 07.6, 08.8, 09.8, 10.5. Server error: AC-01.9, 01.10, 04.5, 05.6, 06.5, 07.6, 08.8, 09.8, 10.5. Loading/empty: AC-03.7, 04.6, 05.7, 06.5, 07.6, 09.8, 10.5, 11.6 | Matching TEST IDs (C and E) | Client and E2E files listed above | **Partly verified**: Sprint 1 and F-07 to F-10 PASS R-S3; F-11 phase 1 PASS R-S4; F-12/F-13 and the SR-01 audit **planned** (Final) |
| NFR-11 | SR-03 | 2 (Lab 5) | Required check on `main` and `staging/**` | `test-and-docker` on every PR | `.github/workflows/ci.yml`; ruleset `protect-main` | PASS: every merged Sprint 2 PR ran it (for example 45592941608) |
| NFR-12 | SR-02 | 1 → 2 | AC-03.1, AC-SR2.1; CI secret scan | TEST-03.1a–d, TEST-SR2.1; CI scan | `demo-seed.test.ts`, `seed-policy.test.ts`; manual SR2.1 at `v0.1.0` | **Partly verified**: tests and the manual check PASS; the CI secret scan doesn't exist yet (D-09) |

## Coverage

**Fully verified** means every AC of the requirement has run and passed on integrated code (R-S1 to R-S4). **Partly verified** means some of its verification passed and some is still in a PR, missing or planned; the row says which part.

| Set | Total | Fully verified | Partly verified | Planned | Retired |
|---|---|---|---|---|---|
| FR | 25 | 21: FR-01 to FR-21 | 1: FR-22 (phase 1 integrated, R-S4; AC-11.3 planned) | 3: FR-23, FR-24, FR-25 | 0 |
| BR | 16 | 14: BR-01 to BR-06, BR-08 to BR-14, BR-16 | 1: BR-15 (F-10 released and verified; F-11 phase 2 and F-13 planned) | 0 | 1: BR-07 |
| NFR | 12 | 9: NFR-01 to NFR-07, NFR-08 (D1 walkthrough; re-run planned), NFR-11 | 2: NFR-10 (F-12/F-13 and the SR-01 audit planned), NFR-12 (CI secret scan missing, D-09) | 1: NFR-09 | 0 |

**Uncovered or partly covered at the D2 checkpoint:**
- **Sprint 2:** none. F-07 to F-10 are released as `v0.5.0` and accepted (R-S3, deployed checks 13/13 PASS).
- **Sprint 3:** FR-22's AC-11.3 (needs F-10), FR-23, FR-24, FR-25 and NFR-09 (F-12, F-13). Contracts approved, implementation planned for Final. F-11 phase 1 is integrated (R-S4) and goes out as `v0.6.0` (DEC-15).
- **Open gaps from the change register:** D-09 (CI secret scan, NFR-12) and D-14 (Minor: Manage milestone panel layout). D-10 and D-11 are resolved.
- **Re-runs planned before Final:** NFR-07 persistence on each new release, NFR-08 walkthrough, the NFR-10 SR-01 audit.

Every baseline FR, BR and NFR still maps to a feature or system responsibility and a sprint. Not traced because they are explicitly out of scope: EX-01 to EX-07 (SRS §3.2).

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
| 2026-11-05 | A session that ends mid-use returns to login | PR #32 review | AC-01.10 added; FR-03, NFR-04, NFR-10 rows updated; TEST-01.10a, TEST-01.10b; TEST-01.10c (stale 401, PR #33 review) |
| 2026-11-04 | Authorization rules made testable: identical 404 body, check order, malformed IDs | F-02 contract v0.1 (PR review pending) | AC-02.1–AC-02.4 wording; AC-02.5 added; BR-04 also verified by TEST-02.4b |
| 2026-11-04 | JSON parsed per route after the guards (no global parser) | PR #29 review | AC-02.5 wording; TEST-02.1 malformed-body case, TEST-02.5e, TEST-02.5f |
| 2026-11-04 | Submission rules made testable; team status "Submitted" owned by F-05 | F-05 contract v0.1 (PR review pending) | AC-05.1, AC-05.3–AC-05.5 wording; AC-05.8, AC-05.9 added; FR-09 also verified by F-05 |
| 2026-11-24 | CR-01: a milestone's due date must be at least 24 h after server time on create (was: any future time) | Lab 7 change request #73 | BR-05 and AC-04.2 reworded; TEST-04.2u/i gain now + 24 h − 1 s (reject) and now + 24 h (accept) rows; TEST-04.2e expects the new message and adds a real-server now + 1 h rejection (PR #74 review) |

| 2026-11-24 | BR-07 retired; versioned resubmission (BR-08) | F-09 contract v0.2 (#89), PR #92 | AC-05.4 retired; TEST-05.1, 05.6, 05.7, 05.1e, 08.9i revised (changes.md D-02) |
| 2026-11-24 | Milestones can't be deleted (no endpoint) | F-08 contract (#88) | BR-14 verified by TEST-08.7i |
| 2026-11-25 | Single-course team creation | F-07 contract (#91) | AC-07.1; release gate R-01 |
| 2026-11-25 | Grade draft and released snapshot; shared `studentGrade(row)` | F-10 contract v0.2 (#96) | AC-10.1 to 10.3, 11.3, 13.2 |
| 2026-11-25 | F-11 phase 1 omits the grade; DEC-15 release path | F-11 contract v0.3 (#93) | AC-11.3 planned; F-11 phase 1 integrated after `v0.5.0` (R-S4), released with `v0.6.0` |
| 2026-11-25 | F-12 fixed 404 for an unsupervised team filter; F-13 published-only export | #93, #97 | AC-12.3, AC-13.2, AC-13.3 |
| 2026-11-25 | A grade release names the confirmed draft (`expectedScore`; 409 `GRADE_DRAFT_CHANGED`) | F-10 contract v0.5, PR #101 review | AC-10.3, AC-10.5; TEST-10.3di added, TEST-10.3bi (a) changed |

Later changes are added here with the PR that approved them.
