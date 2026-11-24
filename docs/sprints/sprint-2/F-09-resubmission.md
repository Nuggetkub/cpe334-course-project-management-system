# F-09 Versioned resubmission and version history. Engineering Contract

**Issue:** #82 · **Owner:** @Nuggetkub · **Reviewer:** @Earth2509 · **Branch:** `feature/82-f09-resubmission`

**Requirements:** FR-15, FR-16, FR-17, BR-08 (replaces BR-07, DEC-04), BR-10, BR-11, BR-12, DEC-13, DEC-14, NFR-02, NFR-03, NFR-05, NFR-06, NFR-10.

**Baseline:** SRS v0.3; F-05 and F-06 contracts; F-08 contract v0.1 (window model); release `v0.4.0` (`aa191ba`).

| Version | Date | Author | Reviewer | Change |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-11-25 | @Nuggetkub | @Earth2509 | Contract and planned tests, recorded before the migration, tests and implementation |
| 0.2 | 2026-11-25 | @Nuggetkub | @Earth2509 | PR #89 review of `503b0c3`: retry success and retry exhaustion tested separately with a deterministic collision (TEST-09.6u); each attempt in a fresh transaction; the changed Sprint 1 assertions TEST-05.1 (`late` key) and TEST-05.7 (form after a stored submission) named |
| 0.3 | 2026-11-25 | @Nuggetkub | @Earth2509 | Found during implementation, recorded before the implementation commit: TEST-05.6 (client) and TEST-05.1e (E2E, Student step) and, after the rebase onto F-08 v0.4, TEST-08.9i also asserted BR-07 (no form after a first submission) and now expect the "Submit a new version" form. Pending @Earth2509's review in the F-09 PR |

## 1. Feature design

A Student submits work for a milestone **again** while its window accepts work. Each submission creates the next version (1, 2, 3, …). Earlier versions are never changed or deleted (BR-08).

- **Late window:** submissions made in the late window (F-08) are accepted and marked **Late**. That applies to a team's first submission and to a new version (FR-17, DEC-14).
- **Version history:** team members and the team's assigned Supervisors see the full history of a milestone (FR-16), newest first.
- **Feedback:** feedback stays on the version it was written for (BR-10), and each version shows its own feedback.

**Team status (SRS §4.3.1).** The Sprint 2 row is added on top of the Sprint 1 rows:
1. **Late:** the latest version is marked Late.
2. **Submitted:** the latest version is on time.
3. **Not submitted / Overdue:** as in Sprint 1.

The window (F-08) never changes the team status.

**Retired requirement.** BR-07 (one submission per team, Sprint 1 only) is superseded by BR-08, as planned in DEC-04 and in the traceability matrix ("planned S2"). TEST-05.4a and TEST-05.4b assert the retired rule, so they are **retired and replaced** by TEST-09.1i and TEST-09.6i, which are recorded in traceability "Approved changes". All other F-05 tests stay.

### Workflow and authorization

`POST /api/milestones/:milestoneId/submissions` keeps the F-05 guards: requireAuth (401) → requireRole(STUDENT) (403) → requireMilestoneAccess (404) → jsonBody (400) → `parseSubmission` (400). Then, using one server instant `now` and the F-08 `submissionWindow(milestone, now)`:

```
window CLOSED because a Supervisor closed it        ─► 409 MILESTONE_CLOSED   (BR-11)
window CLOSED because the deadline passed           ─► 409 DEADLINE_PASSED    (BR-06)
window OPEN  ─► insert version = max(version) + 1, late = false ─► 201
window LATE  ─► insert version = max(version) + 1, late = true  ─► 201
unique (milestone_id, version) race ─► retry the insert (up to 3 attempts) ─► 201, else 409 SUBMISSION_CONFLICT
```

**Retry design.** One attempt reads `max(version)` for the milestone and inserts `max + 1` inside **its own transaction**. A failed attempt is rolled back, and the next attempt starts a fresh transaction, so it re-reads the latest version instead of reusing the stale number. Only a uniqueness violation on `(milestone_id, version)` (Prisma `P2002`) is retried. Any other error is passed on unchanged. The loop lives in one small helper, `insertNextVersion(attempt, maxAttempts = 3)`, so tests can drive it with a fake attempt function that collides on demand.

`409 ALREADY_SUBMITTED` is removed (BR-07 retired).

`GET /api/milestones/:milestoneId/submissions` runs requireAuth → requireMilestoneAccess (404 for hidden scope), then returns all versions newest-first.

`GET /api/milestones/:milestoneId/submission` (F-05) is kept and still returns the **latest** version.

| Operation | Anonymous | Student own team | Student other/no team | Assigned Supervisor | Other Supervisor |
| --- | --- | --- | --- | --- | --- |
| Submit / resubmit | 401 | 201 if the window accepts work | 404 | 403 | 403 |
| Version history | 401 | 200 | 404 | 200 | 404 |

### Validation and rules
- **Input:** title, description and link use the F-05 rules (BR-09) unchanged.
- **Ignored fields:** client-sent `version`, `late`, `submittedAt` and `submittedBy` are ignored. The server sets them.
- **Deadline boundaries:** all comparisons use server time. Exactly `dueAt` is on time. Exactly `lateUntil` is accepted as Late. `lateUntil + 1 ms` is rejected.
- **Version numbers:** they are gap-free per milestone, as long as no insert has failed.

### Dependencies and scope
- **Uses:** F-05 (`parseSubmission`, `presentSubmission`, the guards), F-06 (feedback per submission ID, unchanged), and F-08 (`lateUntil`, `closedAt`, the `submissionWindow(milestone, now)` signature). F-08 must be merged first.
- **Out of scope:** editing or deleting a version; file uploads (links only, as in Sprint 1); grades (F-10); the progress board (F-11).

## 2. Layer specifications

### API

| Endpoint | Request | Success | Errors |
| --- | --- | --- | --- |
| POST /api/milestones/:milestoneId/submissions | `{title, description?, link}` | 201 `{submission}` | 401 · 403 · 404 · 400 · 409 `MILESTONE_CLOSED` · 409 `DEADLINE_PASSED` · 409 `SUBMISSION_CONFLICT` |
| GET /api/milestones/:milestoneId/submissions | — | 200 `{milestone, submissions: Submission[]}`, newest first; an empty list is 200 | 401 · 404 |
| GET /api/milestones/:milestoneId/submission | — | 200 `{milestone, submission \| null}` (latest version) | as F-05 |

- **Submission:** the F-05 fields plus `late: boolean`. `version` is now any value ≥ 1.
- **Milestone:** `teamStatus` can now be `LATE`.
- **Feedback:** the F-06 endpoints `/api/submissions/:submissionId/feedback` are unchanged and work for every version.
- **Messages:**
  - `MILESTONE_CLOSED`: "This milestone is closed."
  - `DEADLINE_PASSED`: "The deadline for this milestone has passed."
  - `SUBMISSION_CONFLICT`: "Another submission was saved at the same moment. Please try again."

### Data

The migration is additive. It adds `late boolean NOT NULL DEFAULT false` to `submissions`:
- existing rows are on-time version 1 submissions, so `false` is correct for them;
- the existing `UNIQUE (milestone_id, version)` stays as the concurrency guard;
- no other schema change.

### UI

**Milestone page, Student:**
- shows the latest version, as in F-05;
- while the window is Open or Late window, shows a **Submit a new version** form, using the F-05 fields and states;
- in the Late window, a notice says "Submissions now are marked Late.";
- when the milestone is closed, shows "This milestone is closed." and no form.

**Version history** (Students and Supervisors):
- a list, newest first: "Version N", title, link, submitter, Bangkok time and a **Late** badge where it applies;
- each version shows its own feedback (F-06);
- assigned Supervisors see the F-06 feedback form on every version;
- the list shows loading, empty ("No submissions yet") and error-with-Retry states (NFR-10).

**Badges:** milestone list and detail badges show "Team status: Late".

## 3. Acceptance criteria

| AC | Given | When | Then | Covers |
| --- | --- | --- | --- | --- |
| AC-09.1 | Team A has version 1 for an Open milestone | A member POSTs a valid submission | 201 with version 2, `late: false`. Version 1 is unchanged (same row values). A third submission → version 3 | FR-15, BR-08 |
| AC-09.2 | A milestone with `dueAt` < now ≤ `lateUntil` | A member submits for the first time, then submits again | 201 version 1 `late: true`, then version 2 `late: true`. Team status `LATE`. At exactly `lateUntil` → accepted. At `lateUntil + 1 ms` → 409 `DEADLINE_PASSED`, no row | FR-17, BR-12, DEC-14 |
| AC-09.3 | A milestone closed by a Supervisor (future due), or with the deadline passed and no late window | A member POSTs | 409 `MILESTONE_CLOSED` or 409 `DEADLINE_PASSED` respectively; no row | BR-11, BR-06 |
| AC-09.4 | Team A has versions 1–3 | sA, sA2, pA or pA2 GETs the history; sB, s0 or pB GETs it | Team A members and assigned Supervisors get 200 with 3 versions newest-first, each with submitter, time and Late. The others get the fixed 404 | FR-16, BR-02, BR-03 |
| AC-09.5 | Feedback exists on version 1 | Versions 2 and 3 are submitted | Version 1's feedback is still returned for version 1 only. Versions 2 and 3 have none until it is written. Team status follows the latest version | BR-10, DEC-13 |
| AC-09.6 | Team A has version 1 | Two members POST at the same moment, or a version is inserted between a request's read and its insert | The colliding request retries in a fresh transaction and gets the next free version: both 201 with versions 2 and 3, with no duplicate or missing number. 409 `SUBMISSION_CONFLICT` happens only after 3 colliding attempts, and leaves no partial row | BR-08 |
| AC-09.7 | A Supervisor, a Student of another team, an anonymous user, a malformed ID | They POST or GET | 401, then 403 (Supervisor POST), then 404 (hidden scope), then 400; no write | NFR-02, NFR-03, NFR-05 |
| AC-09.8 | A Student and a Supervisor on the milestone page | They submit a new version (valid, invalid, 5xx) or view the history | The F-05 form states; the Late notice in the Late window; no form when Closed; the history list with Late badges and per-version feedback; loading, empty and error states | NFR-10 |

## 4. Software Test Specification

Levels as in F-08: **U** (Vitest), **I** (Supertest against PostgreSQL `cpms_test` with a fixed `now`), **C** (React with mocked fetch), **E** (Chromium against `cpms_e2e`).

| Test ID | AC | Level | Preconditions / inputs | Steps | Expected |
| --- | --- | --- | --- | --- | --- |
| TEST-09.2u | 09.2, 09.5 | U | Latest version on time, Late or missing; due and lateUntil boundaries | `teamStatus(milestone, latest, now)` | LATE / SUBMITTED / NOT_SUBMITTED / OVERDUE exactly as in §1 |
| TEST-09.1i | 09.1 | I | sA submitted v1 to Open mA (replaces TEST-05.4a) | sA2 POSTs, then sA POSTs | 201 v2, then 201 v3, `late: false`. v1 row unchanged. 3 rows |
| TEST-09.2i | 09.2 | I | mL due D with lateUntil L; clock D + 1 s, then L, then L + 1 ms | First submission, resubmission, then a POST at L + 1 ms | 201 v1 Late, 201 v2 Late (at L), then 409 `DEADLINE_PASSED`. GET shows team status `LATE` |
| TEST-09.3i | 09.3 | I | mC closed with future due; mP deadline passed, no window | POST to each | 409 `MILESTONE_CLOSED`; 409 `DEADLINE_PASSED`; counts unchanged |
| TEST-09.4i | 09.4 | I | mA with v1–v3 | GET the history as sA, sA2, pA, pA2, sB, s0, pB | 200 newest-first ×4, fixed 404 ×3 |
| TEST-09.5i | 09.5 | I | Feedback on v1 | Submit v2 and v3; GET feedback for v1, v2, v3 | v1 has its feedback; v2 and v3 are empty |
| TEST-09.6u | 09.6 | U | A fake version store holding v1, and an attempt function that reads `max(version)` from it and inserts `max + 1`. (a) Before the first insert, the test adds v2 to the store, so attempt 1 collides with `P2002`. (b) The store always collides. (c) The attempt throws a non-`P2002` error | Call `insertNextVersion` | (a) Two attempts; the second re-reads max = 2 and returns v3; the store holds v1, v2, v3 once each. (b) Exactly 3 attempts, then 409 `SUBMISSION_CONFLICT`, no row added. (c) One attempt; the original error is rethrown |
| TEST-09.6i | 09.6 | I | mA with v1 (replaces TEST-05.4b) | Two members POST with `Promise.all`; read all rows | Both 201 with versions {2, 3}: no duplicate, no gap, 3 rows. (The deterministic collision and the exhausted budget are TEST-09.6u, because a real race can't be forced to collide on every run.) |
| TEST-09.7i | 09.7 | I | pA, sB, anonymous, malformed ID, malformed JSON | POST and GET | 403 / 404 / 401 / 404 / 400 in F-02 order; no write |
| TEST-09.8c | 09.8 | C | Mocked Open, Late and Closed milestones; history with 3 versions and feedback | Render; submit (valid, 400, 500); load the history | Form states; Late notice; no form when Closed; history list and badges; loading, empty and error states |
| TEST-09.1e | 09.1, 09.4 | E | Journey team with one submission | The Student submits version 2 and reloads; the Supervisor opens the history | Two versions persist and are shown newest-first to both roles |

**Revised and retired tests:**
- TEST-05.4a and TEST-05.4b are retired; TEST-09.1i and TEST-09.6i replace them.
- TEST-05.3b keeps checking the on-time/deadline boundary. With no late window, its expected 409 is still `DEADLINE_PASSED`.
- **TEST-05.1** (server) asserts the exact `SUBMISSION_KEYS`. It adds `late` and checks `late: false` for an on-time submission.
- **TEST-05.7** (client) "shows a persisted submission read-only" currently expects no submit button once a submission is stored. For a Student in an accepting window (Open or Late), the page now shows the stored submission **and** the "Submit a new version" form. The checks that a Closed milestone, a passed deadline and a Supervisor show no submission form stay as they are.
- F-05 E2E and component tests that expect "already submitted" UI text are updated to the new-version form.
- **Added in v0.3:**
  - **TEST-05.6** (client) ended by asserting that the form disappears after a first successful submission (BR-07). Its 409, 5xx and network value-retention checks are unchanged. Its last step now expects the empty "Submit a new version" form.
  - **TEST-05.1e** (E2E) asserted that the Student sees no Submit button after reload (BR-07). It now expects "Submit a new version". The Supervisor's no-form check in the same test is unchanged.
  - **TEST-08.9i** (F-08 v0.4, added after this contract) checked `ALREADY_SUBMITTED` on an open milestone (BR-07). It now expects 201 with version 2. Its close-wins half (`MILESTONE_CLOSED` even when the team has submitted) is unchanged.
- Every change is listed in the PR, with its reason.

**Commit order:**
1. contract (this PR, reviewed);
2. migration;
3. tests, with a RED run on the pre-implementation commit;
4. implementation, with a GREEN run;
5. full regression.

## 5. Definition of Done

- [ ] Contract v0.1 reviewed and approved by @Earth2509 before the migration, tests and code. F-08 merged first.
- [ ] Additive `late` migration; existing submissions unaffected.
- [ ] API, team status and UI implemented; BR-07 tests retired and replaced as listed; no other test weakened.
- [ ] RED and GREEN runs recorded with commands, commits and counts.
- [ ] Server, client and Docker checks pass in CI. Local Playwright passes.
- [ ] Traceability (FR-15–FR-17, BR-07 retired, BR-08, BR-10) and the feature inventory updated.
- [ ] PR approved by @Earth2509, merged into `staging/sprint-2`, released in `v0.5.0` and checked on the deployed app.
