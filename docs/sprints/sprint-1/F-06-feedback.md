# F-06 Feedback on a submission — Engineering Contract

**Issue:** #11 · **Branch:** `feature/11-f06-feedback` · **Sprint:** 1 · **Owner:** @Nuggetkub (taken over from @Earth2509 on 5 Nov) · **Reviewer:** @Earth2509
**Requirements:** FR-18, FR-19 · BR-01, BR-02, BR-03, BR-10 · NFR-03, NFR-05, NFR-06, NFR-10
**Decisions:** DEC-06 (team members read own-team feedback), DEC-10 (cross-team → 404) · **Traceability:** [traceability.md](../../traceability.md)

| Version | Date | Author | Reviewer | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-05 | @Nuggetkub | @Earth2509 | Contract committed before implementation, on top of F-05 (#36) in staging |

---

## 1. Feature design

### 1.1 Behaviour

A **Supervisor assigned to the team** opens a milestone that has a submission and writes feedback
on that submission version. The server stores the text, the supervisor and the server time.
A submission can receive **several feedback entries** (from the same or another assigned
supervisor); entries are never edited or deleted in Sprint 1.

**Team members and assigned Supervisors** see the feedback list on the milestone page, oldest
first, each entry with its author, time (Asia/Bangkok) and **the version it refers to** (FR-19).
In Sprint 1 every submission is version 1; when F-09 adds versions in Sprint 2, feedback stays on
the version it was written for (BR-10), because it points to the submission row, not the milestone.

This closes the Sprint 1 journey (D1 §2): F-04 milestone → F-05 submission → **F-06 feedback**.

### 1.2 Workflow

```
Milestone page with a submission (F-05)
  └─ GET /api/submissions/:id/feedback ─► requireAuth → ownership (submission → milestone → team) ─✗─► 401 / 404
         │✓
         ▼
     { feedback: [ {id, submissionId, version, text, createdAt, author{id,name}} ... ] }
         ├─ empty ───────────────► "No feedback yet"
         └─ entries ─────────────► list, oldest first
     Supervisor only: feedback form
         │ client validation ─✗─► field message, no request
         ▼
POST /api/submissions/:id/feedback
  requireAuth ─✗─► 401
  requireRole("SUPERVISOR") ─✗─► 403 FORBIDDEN
  load submission → assertTeamAccess(milestone.teamId) ─✗─► 404 NOT_FOUND (missing, unassigned)
  jsonBody ─✗─► 400 BAD_REQUEST
  validate text ─✗─► 400 VALIDATION_ERROR + fields.text
  INSERT feedback(submission_id, supervisor_id = caller, created_at = server now)
  201 { feedback }
```

Guard order is F-02's: **401 → 403 → 404 → 400**. There is no business-rule 409: feedback may be
added at any time, before or after the milestone deadline.

### 1.3 Dependencies

| Depends on | Why | State |
|---|---|---|
| F-01, F-02 | `requireAuth`, `requireRole`, `assertTeamAccess`, `parseId`, `jsonBody`, protected-endpoint list, `apiFetch`, central 401 handling | Merged |
| F-04 (#35) | `createApp({ now })`, `formatBangkok`, milestone page | Merged |
| **F-05 (#36)** | `submissions` table (feedback points to `submissions.id`); `GET /api/milestones/:id/submission` gives the page the submission ID; `MilestonePage.tsx` submission view | Merged |

### 1.4 Business rules, validation and boundaries

| Rule | Detail |
|---|---|
| Who may write (BR-01, BR-02) | A **Supervisor assigned to the submission's team** (co-supervisors included). Students → 403, even on their own team. Unassigned Supervisors, missing or malformed submission IDs → 404, identical body (DEC-10) |
| Who may read (FR-19, BR-03, DEC-06) | Members of the team and its assigned Supervisors. Other teams' Students, Students with no team, unassigned Supervisors → 404 |
| Version (BR-10) | Feedback references exactly one submission row (FK); the response carries that row's `version` |
| Text (BR-10) | Required string; surrounding spaces trimmed; 1–2000 characters (Unicode code points) after trimming. Message: "Enter feedback (1–2000 characters)." |
| Server-set fields | Author, submission and time come from the session, the URL and the server clock. `supervisorId`, `createdAt`, `submissionId` in the body are ignored |
| Immutability | No edit or delete in Sprint 1 |

**Out of scope (disclosed):** grades (F-10), editing/deleting feedback, notifications, feedback on
versions other than the stored one (versions arrive with F-09).

### 1.5 Permissions

| Endpoint | Unauth. | Student, own team | Student, other / no team | Supervisor, assigned | Supervisor, unassigned |
|---|---|---|---|---|---|
| `POST /api/submissions/:submissionId/feedback` | 401 | 403 | 403 | ✓ | 404 |
| `GET /api/submissions/:submissionId/feedback` | 401 | ✓ | 404 | ✓ | 404 |

A Student on another team gets 403 on POST because the role check comes first (F-02 order); no
data is revealed either way. Both endpoints join `server/tests/support/protected-endpoints.ts`.

---

## 2. Layer specifications

### 2.1 API

| Method + path | Request | Success | Errors |
|---|---|---|---|
| `POST /api/submissions/:submissionId/feedback` | Bearer; `{ "text": string }` | **201** `{ "feedback": Feedback }` | 401 · 403 · 404 · 400 `BAD_REQUEST` · 400 `VALIDATION_ERROR` + `fields.text` |
| `GET /api/submissions/:submissionId/feedback` | Bearer | **200** `{ "feedback": Feedback[] }`, ordered `createdAt` then `id` ascending; empty array when none | 401 · 404 |

```json
"Feedback": {
  "id": 4, "submissionId": 7, "version": 1,
  "text": "Good start. Add tests for the login page.",
  "createdAt": "2026-11-09T03:00:00.000Z",
  "author": { "id": 21, "name": "Demo Supervisor 1" }
}
```

`author` has only `id` and `name`. Server modules: `server/src/feedback/routes.ts`,
`server/src/feedback/validate.ts` (`parseFeedback(body)`). The list is not paginated in Sprint 1
(a handful of entries per submission); NFR-09's paginated lists do not include it.

### 2.2 Data

Additive migration `add_feedback`:

| Table `feedback` | Type | Constraint |
|---|---|---|
| `id` | serial | PK |
| `submission_id` | int | FK → `submissions.id`, `ON DELETE RESTRICT` (BR-10: one specific version) |
| `supervisor_id` | int | FK → `users.id`, `ON DELETE RESTRICT` |
| `text` | varchar(2000) | not null |
| `created_at` | timestamp(3) | not null; server time |

Index `(submission_id, created_at, id)` for the ordered list. No team column: the team is
`submission → milestone → team`, the same chain the ownership check uses.

### 2.3 UI

Extends `client/src/pages/MilestonePage.tsx` below the submission view (only when a submission exists).

| Element | Behaviour |
|---|---|
| Heading | "Feedback" |
| Loading (AC-06.5) | "Loading feedback…" (`role="status"`) |
| Empty (AC-06.5) | "No feedback yet" |
| Entry (AC-06.3) | The text (line breaks kept), then "{author} on {formatBangkok(createdAt)} · version {n}" |
| Load failure | "Could not load feedback." with **Retry** |
| Form (Supervisor only) | *Feedback* text box and **Add feedback** (→ "Saving feedback…", disabled while in flight) |
| Client validation (AC-06.2) | Empty after trimming or over 2000 → "Enter feedback (1–2000 characters)." under the box; no request |
| Server 400 (AC-06.2) | `fields.text` shown under the box |
| 5xx / network (AC-06.5) | Banner "Could not save feedback. Please try again."; the text is kept; button re-enabled |
| Success | Entry appended to the list, box cleared, "Feedback added." (`role="status"`) |
| Student | Same list, no form |

### 2.4 Configuration

None.

---

## 3. Acceptance criteria

AC-06.1–AC-06.5 are fixed in [traceability.md](../../traceability.md) (wording made precise here).

| AC | Given | When | Then (observable) | Req |
|---|---|---|---|---|
| AC-06.1 | A Supervisor (or co-supervisor) is assigned to the team that submitted | They post valid feedback on that submission | 201 with the feedback; one row with that submission, the caller as author and server time; body-supplied author/time/submission are ignored | FR-18, BR-10 |
| AC-06.2 | An assigned Supervisor | They post text that is empty after trimming or over 2000 characters | 400 `VALIDATION_ERROR` with `fields.text`, no row; the form shows the message under the box and checks it before sending | BR-10, NFR-10 |
| AC-06.3 | Feedback exists on the team's submission | A team member or assigned Supervisor opens the milestone | They see every entry, oldest first, with author, Bangkok time and the version it refers to | FR-19, DEC-06 |
| AC-06.4 | A Student (any team), an unassigned Supervisor, another team's Student, or a Student with no team | They post or read feedback, including with a malformed body | POST: Student → 403, unassigned Supervisor → 404; GET: outsiders → 404, identical to a missing submission; order 401 → 403 → 404 → 400; no row written | BR-01, BR-02, BR-03, NFR-03 |
| AC-06.5 | The milestone page shows a submission | Feedback is loading, empty, or saving fails with 5xx/network | "Loading feedback…", then "No feedback yet"; on failure the banner appears, the text is kept and the Supervisor can retry | FR-19, NFR-10 |

---

## 4. Software Test Specification

Levels as in F-05: **U** unit · **I** API + DB (`cpms_test`, clock fixed by `createApp({ now })`) ·
**C** client component (`fetch` mocked) · **E** end-to-end (`cpms_e2e`). Fixture: F-02's
`createTeamsFixture`, plus sA2 in team A, milestone mA with submission sub (by sA) and milestone mB
with submission subB (by sB), all inserted directly.

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-06.2a | AC-06.2 | U | — | `parseFeedback` with text `""`, `"   "`, 1 char, `"  x  "`, 2000, 2001, 2000 emoji, non-string, missing, `null`/array body, extra `supervisorId` | Valid ones trimmed with extra fields dropped; invalid ones → `fields.text` with the message |
| TEST-06.1 | AC-06.1 | I | pA and pA2 signed in; clock fixed | Each POSTs to sub, one with `supervisorId: pB`, `createdAt: 2000-…`, `submissionId: subB` in the body | 201 each; exact response keys; rows have author = caller, `created_at` = clock, `submission_id` = sub |
| TEST-06.2b | AC-06.2 | I | pA signed in | POST `{}`, `{text:"   "}`, `{text: 2001 chars}`, `{text: 5}` | 400 `VALIDATION_ERROR` with only `fields.text`; no row |
| TEST-06.3 | AC-06.3 | I | Two entries on sub at different times | GET as sA, sA2, pA, pA2 | 200; both entries oldest first, each with `version: 1` and `author {id,name}` |
| TEST-06.4a | AC-06.4 | I | sA (own team) and sB signed in | POST valid text to sub | 403 for both (`expectForbidden`); no row |
| TEST-06.4b | AC-06.4 | I | Feedback exists on sub | GET as sB, s0, pB; POST as pB; GET/POST for `999999` and `abc` | All 404 (`expectHidden`); still one row |
| TEST-06.4c | AC-06.4 | I | — | POST malformed JSON as sA, pB, pA | 403, 404, 400 `BAD_REQUEST` |
| TEST-02.1 (extended) | AC-02.1 | I | Both endpoints in the protected list | The existing loop | 401 for every bad header, also with a malformed body |
| TEST-06.5a | AC-06.5, AC-06.3 | C | Submission present; feedback GET pending, then `[]`; separately two entries | Render as Student | "Loading feedback…" then "No feedback yet"; entries in order with "… · version 1" and Bangkok time; no form |
| TEST-06.2c | AC-06.2 | C | Supervisor; then POST answers 400 `fields.text` | Submit empty box; then 2001 characters; then valid text | Message and no POST for the first two; server message under the box after the third |
| TEST-06.5b | AC-06.5, AC-06.1 | C | Supervisor; POST → 500, then network error, then 201 | Submit three times | Banner twice with the text kept and the button enabled; then the entry appears, the box is empty and "Feedback added." shows |
| TEST-06.5c | AC-06.5 | C | Feedback GET → 500, then `[]` | Render, select **Retry** | "Could not load feedback." then "No feedback yet" |
| TEST-06.1e | AC-06.1, AC-06.3 | E | `e2e-prepare` adds a milestone with a submission by `student2@e2e.test` in "E2E Submission Team" | Supervisor adds feedback; Student 2 signs in, opens the milestone, reloads | Student sees the same text, author and "version 1" |

**Count (v0.1):** 13 STS rows: 1 unit (U), 7 API+DB integration (I, including the extended
TEST-02.1), 4 client component (C), 1 end-to-end (E).

**TDD evidence:** commit order is (1) this contract, (2) the `feedback` migration, (3) failing tests
with the red run recorded, (4) implementation (green run). A missing-module failure is reported as
such and not claimed as behavioural red.

---

## 5. Definition of Done

- [x] Behaviour in §1–§2 implemented in API, DB (additive migration) and UI.
- [x] Every test in §4 exists and passes; the red run before the implementation is recorded in §6 with command, counts and commit SHA. TEST-06.2a failed only because `parseFeedback` did not exist yet; this is stated, not claimed as behavioural red.
- [x] `server`: `npm run typecheck`, `npm test`, `npm run build`; `client`: `npm test`, `npm run build`; root: `npm run e2e` — all pass on the PR head.
- [x] Both endpoints in the protected-endpoint list; README API table updated.
- [x] `traceability.md` updated: AC-06.1–06.4 wording, FR-18/FR-19 rows, change-log row v0.12.
- [ ] Reviewed and approved by @Earth2509; merged into `staging/sprint-1`.
- [x] Known limitations disclosed: no edit/delete, no grades, no notifications in Sprint 1.

---

## 6. Implementation and verification record

Branch `feature/11-f06-feedback` from staging `f0ec131` (F-01–F-05 merged). Commit order: contract
`d95acf9` → migration `59cb392` → failing tests `c992c56` → implementation `c076ad1`. Local
PostgreSQL 16 (Docker), Node 24.

### Red at `c992c56` (migration present, no F-06 code)

| Command | Result |
|---|---|
| `npm --prefix server test` | 19 failed / 180 passed. `feedback.test.ts` **10/10 failed on behaviour**: `expected 404 to be 201 / 200 / 400 / 403` (routes not mounted). TEST-02.1: 9 failed (404 instead of 401 on the two new endpoints). `feedback-validate.test.ts` failed to **load** (`parseFeedback` did not exist); not claimed as behavioural red |
| `npm --prefix client test` | 5/5 new TEST-06.x failed (no feedback section); 45 existing passed |
| `npm run e2e` | TEST-06.1e failed; the six F-01/F-04/F-05 journeys passed with the new "F06 submitted milestone" fixture |

### Green at `c076ad1`

| Command | Result |
|---|---|
| `npm --prefix server test` | **209/209**, 15 files |
| `npm --prefix server run typecheck` / `build` | pass / pass |
| `npm --prefix client test` | **50/50**, 7 files; 20 consecutive runs pass after `8eab9aa` |
| `npm --prefix client run build` | pass |
| `npm run e2e` | **7/7** (TEST-01.7b, 01.8b, 04.1e, 04.2e, 05.1e, 05.3e, 06.1e) |

Two test-only changes outside F-06's own files: F-05's client mock answers the feedback request
the page now makes (`c076ad1`), and F-04's TEST-04.6c creates its pending response before
rendering, fixing a race that failed it about 1 run in 15 on staging (`8eab9aa`).
