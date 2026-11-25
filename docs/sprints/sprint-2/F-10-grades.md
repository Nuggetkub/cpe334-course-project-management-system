# F-10 Grades and grade release. Engineering contract

**Issue:** [#83](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/83) · **Owner:** @Earth2509 · **Reviewer:** @Nuggetkub · **Implementation branch:** `feature/83-f10-grades` · **Target:** `staging/sprint-2`, then the reviewed `v0.5.0` release ([#87](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/87)).

**Requirements:** FR-20, FR-21, BR-01–BR-03, BR-15, NFR-03, NFR-05, NFR-10; DEC-06, DEC-10. **Dependencies:** [F-02](../sprint-1/F-02-authz.md), [F-04](../sprint-1/F-04-milestone.md). The [SRS](../../srs.md) and [System SDS](../../system-sds.md) are the baseline; [F-11 phase 2](../sprint-3/F-11-progress-board.md) should reuse the Student-visible projection. F-11 phase 1 does not read or show grades.

| Version | Date (ICT) | Author | Reviewer | Change |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-11-25 | @Earth2509 | @Nuggetkub (requested with contract PR) | Proposed API, grade visibility, acceptance criteria and planned tests before implementation. |
| 0.2 | 2026-11-25 | @Earth2509 | [PR #96 review](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/96#pullrequestreview-6053874548) | Specify deterministic lock tests, grading regardless of submission/window, and one Student grade projection shared with F-11 and F-13. |
| 0.3 | 2026-11-25 | @Earth2509 | Server implementation ready for review | Record API and PostgreSQL evidence; keep the Grade section, browser tests and deployment verification separate. |
| 0.4 | 2026-11-25 | @Nuggetkub | @Earth2509 (Grade UI PR) | Grade section (AC-10.5): TEST-10.5c and TEST-10.1e evidence. UI implemented by @Nuggetkub as offered on #96/#98; no contract rule changed |
| 0.5 | 2026-11-25 | @Nuggetkub | @Earth2509 ([PR #101 review](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/101)) | **Release names the confirmed draft.** `POST …/grade/release` takes `{expectedScore}`; under the milestone lock a different current draft gives `409 GRADE_DRAFT_CHANGED` and changes nothing, so a stale confirmation can't publish another Supervisor's newer draft. New TEST-10.3di (two Supervisors); TEST-10.3bi (a) now expects the stale release to be refused; the UI validates every grade response before rendering (TEST-10.5c). Recorded before the tests and code that implement it |

## 1. Feature design

- A milestone belongs to exactly one team. Store one optional `Grade` row per milestone (`milestone_id` as unique FK); derive the team through `Milestone.team_id` rather than duplicate it. This is a team grade for the milestone, not a score for an individual student or submission version. Grading does not modify the milestone window, submissions or feedback.
- An assigned Supervisor may save a draft and release a saved grade even if the team has no submission (for example, a score of `0` for missing work), before the deadline, during a Late window, or after a milestone is manually closed or its window has ended. Saving and release do not reopen the submission window. A release still requires a saved draft.
- Additive model: `milestone_id` (primary key and FK), current `draft_score`, last `updated_by` and `updated_at`, nullable `released_score`, `released_by`, `released_at`. Database checks enforce score range 0–100 and all-or-none release metadata. Actors and UTC timestamps come from the authenticated Supervisor and the server, never request JSON. No destructive migration, backfill or production seed changes.
- Saving a new draft does not announce it, even after the first release. After a subsequent draft edit the Student still sees the last released score until the Supervisor explicitly releases the new draft. There is no unrelease operation in F-10. If the draft equals the released score, repeat release is idempotent and preserves release attribution and time. Release with no grade returns `409 GRADE_NOT_RECORDED`.
- **A release publishes only the draft the Supervisor confirmed.** The request carries that score as `expectedScore`. After taking the milestone lock, the server compares it with the current draft; if another save changed the draft in between (for example a co-supervisor), it returns `409 GRADE_DRAFT_CHANGED` and changes nothing. The Supervisor then sees the current draft and confirms again.
- Serialize save and release on the same milestone row using the existing F-08 lock inside a Prisma transaction. Read or upsert the grade only after the lock. A release racing an edit publishes one complete draft snapshot; it either publishes the new value or publishes the previously saved value while the new draft stays private. No code path should serialize a raw Grade row to a Student.

### API and error contract

Use `requireAuth` first. Writes then use `requireRole("SUPERVISOR")`. Validate canonical milestone ID and resolve the owning team, apply F-02 scope, then parse/validate the payload where applicable. Missing and hidden resources share the standard generic `404`. Other errors use NFR-05's existing envelope. Student response must not reveal either the existence or metadata of an unreleased draft.

| Method and endpoint | Request | Expected result |
| --- | --- | --- |
| `GET /api/milestones/:milestoneId/grade` | No body. Team Students and assigned Supervisors only. | Student: `200 {grade:{released:false}}` if absent or never released, or `200 {grade:{released:true,score}}` from the released snapshot only. Supervisor: `200 {grade:{draftScore:null,released:false}}` if absent; otherwise include numeric `draftScore` and, only when `released:true`, the published `score` and ISO UTC `releasedAt`. |
| `PUT /api/milestones/:milestoneId/grade` | JSON `{score}`; a JSON integer 0–100; ignore extra properties explicitly. | `200 {grade:…}` using the Supervisor projection; create or update the draft only. Invalid/missing `score`: `400 VALIDATION_ERROR` on `fields.score`; malformed JSON: `400 BAD_REQUEST`. |
| `POST /api/milestones/:milestoneId/grade/release` | JSON `{expectedScore}`: the draft score the Supervisor confirmed, an integer 0–100. Milestone, team and draft are resolved on the server. | `200 {grade:…}` using the Supervisor projection after publishing the current draft; `409 GRADE_NOT_RECORDED` when no draft exists; `409 GRADE_DRAFT_CHANGED` when the current draft isn't `expectedScore` (nothing changes); invalid or missing `expectedScore` → `400 VALIDATION_ERROR` on `fields.expectedScore`; malformed JSON → `400 BAD_REQUEST`. |

Unauthenticated → `401`; Student writes → `403` before any lookup or parsing; an authenticated caller outside the team scope gets the same `404` for another team's record as for a missing milestone. Do not add grades to existing milestone list/detail, submission or feedback responses in F-10.

**One published projection:** export `studentGrade(row)` from `server/src/grades/projection.ts`. It accepts an absent grade or a row containing the persisted released snapshot; it returns exactly `{released: false}` before release (no `score`, draft or release metadata), or `{released: true, score}` afterward, including `score: 0`. The Student milestone grade endpoint, F-11 Phase 2 and F-13 import this helper after their own scope checks. The helper projects data; it does not grant access. The separate Supervisor DTO may show `draftScore` and `releasedAt` as stated above.

## 2. UI design

- Add a Grade section to the existing milestone detail. An assigned Supervisor sees a labeled 0–100 score input, explicit **Save draft** and **Release grade** actions, and the published score separately if a newer draft is pending. The release action applies to the last saved value; disable it if the form contains unsaved changes. Require an explicit confirmation with the saved score before publishing, and send that score as `expectedScore`. If the server answers `GRADE_DRAFT_CHANGED`, show the current draft from the server and require a fresh confirmation. After either write, render the API's response; after reload, read from the server. Validate every grade response (read or write) against the role's shape before rendering; anything else is shown as a recoverable error, never rendered.
- Students see only the published score or **Not released**, with no form, action or hidden draft text. Score `0` is a valid published result. Keep loading, read error + Retry, no grade, draft and published states distinct; show input errors next to the score field and announce server errors. Keep the entered score on failed save, disable writes while pending and keep the existing session-expiry handling.

## 3. Acceptance criteria

| AC | Given / when / then | Requirements |
| --- | --- | --- |
| AC-10.1 | Given an assigned Supervisor and a known milestone, when they save scores including 0 and 100, then exactly one grade row stores the current draft; an invalid score changes nothing. The Supervisor can save and release even with no submission or outside an open submission window. | FR-20, FR-21, BR-15 |
| AC-10.2 | Given a team Student, before any release the same minimal response is returned whether or not a draft exists; when the Supervisor explicitly releases the draft, then the Student sees that score on the next read. | FR-21, BR-03, BR-15, DEC-06 |
| AC-10.3 | Given a changed draft after a release, a Student still sees the previous published score until the next release. A repeat release of an unchanged score preserves the release record. Racing save/release leaves a coherent draft and published snapshot. A release confirmed for an older draft is refused and publishes nothing. | FR-20, FR-21, BR-15 |
| AC-10.4 | Given missing authentication, a Student write, or a caller outside team scope, the API returns its fixed `401`, `403` or masked `404` respectively before validating writes and leaves grade state unchanged. | BR-01–BR-03, NFR-03, NFR-05, DEC-10 |
| AC-10.5 | Given either role on milestone detail, the view distinguishes loading, empty/unreleased, published and recoverable errors. Only the Supervisor sees form actions; incorrect input and transient save failures preserve the input, and unsaved changes cannot be released accidentally. | FR-20, FR-21, NFR-10 |

## 4. Software Test Specification

Use real PostgreSQL for I (Supertest), Vitest for U, React Testing Library for C and Playwright for E. Use fixed clocks where needed, separate team A/B fixtures, one co-supervisor and one unassigned Student. Never run against deployed or shared production data.

| Test ID | AC | Level | Setup and action | Expected |
| --- | --- | --- | --- | --- |
| TEST-10.1u | 10.1–10.2 | U | Parse payloads with `0`, `100`, `-1`, `101`, fractional value, string, null, missing score, and forged `releasedBy`/`teamId`. Call `studentGrade` with absent/draft-only grades, a published `0`, and a published value with a newer draft. | Only valid numeric integers accepted; returned input contains only `score`; all invalid inputs name `fields.score`. Projection omits all fields except `released` before release and returns exactly `{released: true, score}` from the published snapshot afterward, with `0` preserved. |
| TEST-10.1i | 10.1 | I | Assigned Supervisor creates a draft then a co-supervisor saves a different boundary value; send a rejected update. | `200` responses, exactly one row, updated author from session, score unchanged by rejected update. |
| TEST-10.1bi | 10.1–10.2 | I | On separate milestones with no submission, save and release `0` before the deadline, in a Late window, after the deadline with no Late window, and after manual close. Read as Student. | Save and release return `200` in every case; Student sees `0` only after release. No submission appears and the milestone windows are unchanged. |
| TEST-10.1ci | 10.1, 10.3 | I | Issue direct PostgreSQL writes with an out-of-range draft, out-of-range released score, or partial release snapshot. | PostgreSQL rejects each write with SQLSTATE `23514`; no invalid grade row persists. |
| TEST-10.2i | 10.2 | I | Compare Student GET when no grade exists and when a draft of 0 is saved. Then release and read again. Attempt release before recording a grade. | Both pre-release responses are byte-equivalent; no score, draft, or release metadata key. Release-without-draft gives `409`; valid release returns a persisted score of `0` to the Student. |
| TEST-10.3i | 10.3 | I | Publish 70, save draft 82, read as Student and Supervisor, release again, then repeat at a later clock time. | Student sees 70 until release, then 82; assigned Supervisor sees 82 as draft in the interim; repeated release preserves release time and releaser. |
| TEST-10.3bi | 10.3 | I | On PostgreSQL, warm independent connections for the holder, competing writer and observer. Starting from draft 70, hold an uncommitted save of 82 after taking the milestone row lock; start the production release. On a fresh milestone, hold an uncommitted release of 70 with that same milestone lock; start the production save of 82. In each case verify via PostgreSQL that the competing transaction is waiting on the holder's milestone lock (check the blocked statement, not just elapsed time or a later Grade-row write); then commit the holder and await the competitor. | Save held first → the release (confirmed for 70) is refused with `409 GRADE_DRAFT_CHANGED`, nothing is published and the draft is 82; without the lock it would read 70 and publish it. Release held first → published score remains 70 and the draft becomes 82. Both keep one coherent row and correct release attribution. Temporarily omitting the production milestone lock must fail the affected lock assertion; record this RED separately from the no-feature baseline. |
| TEST-10.3di | 10.3 | I | Two assigned Supervisors on one milestone. pA saves 70; pA2 saves 82; pA releases with `expectedScore` 70; then pA releases with 82. Also a missing, non-integer or out-of-range `expectedScore`, and malformed JSON | Stale release → `409 GRADE_DRAFT_CHANGED`, no published score, draft 82, the Student still sees Not released. Release with 82 → `200`, published 82. Invalid `expectedScore` → `400 fields.expectedScore`; malformed JSON → `400 BAD_REQUEST`; no change |
| TEST-10.4i | 10.4 | I | Add all three routes to the F-02 registry; send malformed PUT as Student and foreign Supervisor. Compare missing/foreign milestone for all denied reads and writes; check DB afterward. | Guard order `401 → 403 → 404 → 400`; denied request reveals no detail and makes no change; in-scope malformed JSON is `400 BAD_REQUEST`. |
| TEST-10.5c | 10.5 | C | Simulate loading, GET error then retry, failed save, successful draft, dirty form and release confirmation; a release answered with `GRADE_DRAFT_CHANGED`; malformed `200` bodies on read, save and release; render both roles and a published score of 0. | Labeled field and error, preserved input, disabled actions where required; no Student form; 0 rendered correctly. The release request sends the confirmed `expectedScore`; a changed draft is shown from the server and needs a new confirmation; a malformed body shows an error with Retry and never crashes the page. |
| TEST-10.1e | 10.1–10.2, 10.5 | E | On a dedicated test milestone, Supervisor saves draft and confirms release; Student opens milestone before and after release in a separate session. | Actual API and UI hide the score before release and show it after reload. Existing submission and feedback journeys still pass. |

## 5. Delivery and review gates

- [x] Teammate reviews this contract before feature tests and implementation, including draft-after-release semantics and shared grade visibility for F-11 phase 2 ([PR #96](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/96)).
- [x] Apply the additive Grade migration in the test database; record interface stubs separately. Commit tests before behavior; capture RED about missing grade behavior rather than import/migration errors.
- [x] Include the range and all-or-none release metadata CHECK constraints; verify migration/schema consistency and test the custom constraints in PostgreSQL.
- [x] Verify the server implementation and prior server regression; update the system design, API inventory and traceability.
- [x] Finish the Grade section in milestone detail. Run `TEST-10.5c` and `TEST-10.1e`; report `test-and-docker` and browser E2E separately (see below; CI is reported on the PR).
- [ ] Teammate reviews implementation into `staging/sprint-2`. Verify the deployed release on `v0.5.0` using synthetic team accounts and record before/after-release evidence. Do not mark F-11 AC-11.3 done: its own phase 2 wiring and checks are still required.

### Local server evidence (2026-11-25 ICT)

Base: `staging/sprint-2` at `06cf000`. Tests used a dedicated PostgreSQL database with a disposable Vitest schema; the migration comparison used a separate shadow database.

- Migration and interfaces: `4132703`. From `server/`, `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "<disposable-shadow-db-url>" --exit-code` reported **No difference detected** (exit 0). The PostgreSQL integration test checks the custom constraints that Prisma does not represent.
- RED: `f26993d`, `npm --prefix server test -- grades.test.ts grades-units.test.ts grades-concurrency.test.ts`: **12 failed, 1 passed** (the database constraint test). The failures were missing endpoints or unimplemented grade behavior.
- Lock mutation RED: after implementing the API, temporarily replace the grade service's milestone lock with a plain milestone read. `npm --prefix server test -- grades-concurrency.test.ts`: **2 failed**. PostgreSQL reported waits on grade writes instead of the required milestone `SELECT … FOR UPDATE`. The lock was restored before committing.
- GREEN: `c24c7d4` contains the restored lock and API. The three focused files passed **13 tests** with the implementation in place. The full `npm --prefix server test` run passed **315 tests in 25 files** (exit 0), including the unchanged suites and expanded F-02 route registry. Both `npm --prefix server run typecheck` and `npm --prefix server run build` exited 0.

The server changes do not include the milestone Grade section, browser tests, hosted CI results or deployment. Drafted with OpenAI Codex assistance.

### Local UI evidence (2026-11-25 ICT)

Base: `staging/sprint-2` at `19a9b1d` (after #98 and #100). Commands from the repository root; Docker PostgreSQL 16, Chromium.

- Tests first: `7ab9611`. TEST-10.5c in `client/tests/grade.test.tsx` (8 cases) and TEST-10.1e in `e2e/grades.spec.ts`, with a new fixture team "E2E Team Grades" (`student5@e2e.test`). The fetch mocks of `client/tests/submission.test.tsx` and `client/tests/feedback.test.tsx` also answer the page's new `/grade` read; no assertion changed.
- RED on `7ab9611`: `npx vitest run` (client) **8 failed, 67 passed (75)**, all TEST-10.5c, because there is no Grade region yet. `npx playwright test` **1 failed (TEST-10.1e), 10 passed**.
- GREEN on `906c4b3`: client **75/75**, server **329/329**, both builds pass, `npx playwright test` **11/11**.

### PR #101 review fixes (contract v0.5, 2026-11-25 ICT)

- Contract first: `57ece23`. Interface stub (`releaseGrade` takes `expectedScore`, ignored; no behaviour change, 13/13 grade tests pass): `d582c7c`.
- Tests: `582ff7a`. TEST-10.3di (new, two Supervisors), TEST-10.3bi (a) now expects the stale release to be refused, the other API tests send the confirmed score (helper only), TEST-10.5c (expectedScore in the request, `GRADE_DRAFT_CHANGED` path, malformed `200` bodies) and a second TEST-10.1e journey with two sessions of the same Supervisor (new fixture milestone "F10 stale release milestone").
- RED (`9ad22d2`, whose server and client tests are identical to `582ff7a`): server `npm test` **3 failed, 328 passed (331)**: the stale release returned 200, an invalid `expectedScore` returned 200 and the held-lock release published 82. Client `npx vitest run` **9 failed, 74 passed (83)**. E2E on `582ff7a`: `npx playwright test` **1 failed, 11 passed**; the stale release returned 200 and published 82, as in the review.
- GREEN on `c4c86c2`: server **331/331**, client **83/83**, both builds pass. `npx playwright test`: the first full run had **11 passed, 1 failed**. The failure was TEST-05.1e (F-05), which timed out after 5 s waiting for "Log out" right after sign-in; this change doesn't touch sign-in. `e2e/submissions.spec.ts` alone then passed 2/2, and a full rerun passed **12/12**. The flaky sign-in wait is recorded in the change register.
