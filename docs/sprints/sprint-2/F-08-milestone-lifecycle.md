# F-08 Milestone lifecycle: edit, extend, close, late window. Engineering Contract

**Issue:** #81 · **Owner:** @Nuggetkub · **Reviewer:** @Earth2509 · **Branch:** `feature/81-f08-lifecycle`

**Requirements:** FR-10, FR-11, FR-12, BR-05 (with the CR-01 24 h minimum), BR-11, BR-12, BR-13, BR-14, DEC-13, DEC-14, NFR-02, NFR-03, NFR-05, NFR-06, NFR-10.

**Baseline:** SRS v0.3; F-04 contract v0.5; F-05 contract; DEC-10; release `v0.4.0` (`aa191ba`).

| Version | Date | Author | Reviewer | Change |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-11-25 | @Nuggetkub | @Earth2509 | Contract and planned tests, recorded before the migration, tests and implementation |
| 0.2 | 2026-11-25 | @Nuggetkub | @Earth2509 | Before implementation: §4 names every existing test that changes (response key lists, `submissionWindow` signature), the E2E fixture team, and the interface-stub step in the commit order |
| 0.3 | 2026-11-25 | @Nuggetkub | @Earth2509 | PR #88 review of `51c42cd`: PATCH sends only changed fields (title-only save omits both dates, also when closed) with a new test; TEST-08.3i checks the extension-past-window rejection before clearing; TEST-08.1e verifies the Late window badge on a separate fixture milestone already between `dueAt` and `lateUntil` |
| 0.4 | 2026-11-25 | @Nuggetkub | @Earth2509 | PR #90 review of `f27ae65`: PATCH, close and the submission insert each run in one transaction that locks the milestone row and validates against that locked row (BR-11, BR-12, BR-13 under concurrency); explicit F-05 order MILESTONE_CLOSED → ALREADY_SUBMITTED → DEADLINE_PASSED; TEST-08.9i and TEST-08.10i added. Recorded before the fix commit |

## 1. Feature design

An assigned Supervisor manages an existing milestone from its detail page. They can:
- edit its title and description;
- extend its due date;
- set, change or remove a late window;
- close it.

Students see the resulting window badge, but they never see the controls. The API enforces every rule independently of the UI.

**Split with F-09:**
- F-08 owns the lifecycle fields, the Sprint 2 **window** rows of SRS §4.3.1 (Closed by a Supervisor, Late window), and BR-11 (a Closed milestone rejects submissions).
- F-09 (#82) owns *accepting* submissions in the late window and marking them Late (FR-17), and the Late **team status** row.
- Until F-09 is merged, a submission in the Late window is still rejected with `409 DEADLINE_PASSED`. Both features ship together in the Sprint 2 release `v0.5.0`, so `main` never shows this in-between state.

### Workflow and authorization

`PATCH /api/milestones/:milestoneId` runs these steps in order:
1. requireAuth (401);
2. requireRole(SUPERVISOR) (403);
3. parseId, then load the milestone, then assertTeamAccess (404, fixed F-02 body);
4. jsonBody (400);
5. validation (400);
6. lifecycle rules (409);
7. update → 200 `{milestone}`.

`POST /api/milestones/:milestoneId/close` runs the same guards, then: already closed → 409; else set `closedAt` and `closedBy`, and return 200.

Guard order follows F-02 (401 → 403 → 404 → 400 → 409). Denied requests write nothing.

| Operation | Anonymous | Student own team | Student other/no team | Assigned Supervisor | Other Supervisor |
| --- | --- | --- | --- | --- | --- |
| Edit / extend / late window | 401 | 403 | 403 | 200 if valid | 404 |
| Close | 401 | 403 | 403 | 200 (409 if already closed) | 404 |
| Read (F-04 list/detail) | 401 | 200 | 404 | 200 | 404 |

There is **no delete endpoint** in Sprint 2. That satisfies BR-14 ("a milestone that has submissions cannot be deleted; it can only be closed") for every milestone. `DELETE /api/milestones/:id` is an unknown route, so it returns 404, and the row remains.

### Validation and rules

The PATCH body is a JSON object with **at least one** of `title`, `description`, `dueAt` and `lateUntil`. It carries **only the fields being changed**. A title or description save sends neither `dueAt` nor `lateUntil`, so BR-13 is never applied to an unchanged date, and this works the same on a closed milestone. An absent field is never treated as a change. Unknown fields are ignored, as in F-04 (`teamId`, `createdBy`, `closedAt`, `closedBy`). The server reads one server instant `now` per request.

| Field / rule | Rule | Error |
| --- | --- | --- |
| Empty body | No editable field present | 400 `fields.body` "Change at least one field." |
| title | As F-04: trimmed, 1–120 code points | 400 `fields.title` "Enter a title (1–120 characters)." |
| description | As F-04: trimmed, ≤ 2000 code points; `""` clears it | 400 `fields.description` "Description must be at most 2000 characters." |
| dueAt format | As F-04 `parseDueAt` (explicit zone, valid calendar) | 400 `fields.dueAt` "Enter a due date at least 24 hours from now." |
| dueAt extends only (BR-13) | New `dueAt` > current `dueAt` | 400 `fields.dueAt` "The new due date must be later than the current one." |
| dueAt minimum notice (BR-05, CR-01) | New `dueAt` ≥ `now + MIN_DUE_NOTICE_MS` (reuse the F-04 constant; no copy of the rule) | 400 `fields.dueAt` "Enter a due date at least 24 hours from now." |
| lateUntil format | Same parser as `dueAt`, or `null` to remove the window | 400 `fields.lateUntil` "Enter a valid late-window end." |
| lateUntil after due (BR-12) | `lateUntil` > the effective `dueAt` (the new one if it is changed in the same request) | 400 `fields.lateUntil` "The late window must end after the due date." |
| lateUntil in the future | `lateUntil` > `now` (a window that has already ended is meaningless) | 400 `fields.lateUntil` "The late window must end in the future." |
| Extending past an existing window | If `dueAt` changes, the milestone has a `lateUntil` and the request doesn't send `lateUntil`, the new `dueAt` must be < the existing `lateUntil` | 400 `fields.lateUntil` "The late window must end after the due date." |
| Closed milestone | `dueAt` or `lateUntil` sent for a closed milestone. Title and description stay editable | 409 `MILESTONE_CLOSED` "This milestone is closed." |
| Close twice | Close on a milestone that is already closed | 409 `MILESTONE_CLOSED` "This milestone is closed." |

All field errors are collected and returned together. The 409 rules are checked only after every field is valid. A milestone can't be reopened in Sprint 2. This is a scope decision, not an SRS requirement: FR-11 only asks for closing.

### Window model (SRS §4.3.1, all rows from Sprint 2)

`submissionWindow(milestone, now)` replaces `submissionWindow(dueAt, now)`. The first matching row wins:

| Window | Condition |
| --- | --- |
| `CLOSED` | `closedAt` is set (closed by a Supervisor) |
| `OPEN` | now ≤ `dueAt` |
| `LATE` | `lateUntil` is set and `dueAt` < now ≤ `lateUntil` |
| `CLOSED` | otherwise |

Team status keeps the Sprint 1 rows and ignores the window (DEC-13): closing never changes the team status. F-09 adds the `LATE` team status.

Every caller is updated to pass the milestone: the F-04 present function and the F-05 submission POST.

**Concurrency (v0.4).** A check made on an earlier read is not enough when two writes race. Three writes each run in **one database transaction** that first locks the milestone row (`SELECT … FOR UPDATE`, parameterized) and then decides from that locked row:
- **PATCH** re-reads `dueAt`, `lateUntil` and `closedAt`, then validates BR-12, BR-13 and the CR-01 minimum against them, and writes. Two concurrent PATCHes are serialized, so the second one is validated against the first one's result. A deadline can't move backwards, and `lateUntil > dueAt` holds after every commit.
- **Close** re-reads `closedAt`. Already closed → 409.
- **Submission insert (F-05 POST)** re-reads the milestone and decides in this order: closed by a Supervisor → 409 `MILESTONE_CLOSED` (BR-11); the team already submitted → 409 `ALREADY_SUBMITTED` (BR-07, until F-09); window not Open → 409 `DEADLINE_PASSED`; otherwise insert. A submission that starts while a close holds the lock waits, sees the close, and is rejected. A submission that committed first stays, and the milestone is then closed (BR-11 keeps existing work).

The early F-02 guards (401 → 403 → 404 → 400) stay before the transaction. The writes live in two small service functions (`milestones/service.ts`, `submissions/service.ts`) so tests can call them directly. Lock order for any later feature that also locks a membership row (F-07): **milestone row first, then membership row**.

### Dependencies and scope

- **Uses:** F-04 (`parseDueAt`, `MIN_DUE_NOTICE_MS`, `DUE_AT_MESSAGE`, `presentMilestone`, the detail page) and F-05 (submission POST).
- **Out of scope:**
  - accepting late submissions and Late marking (F-09);
  - reopening;
  - deleting;
  - editing a milestone's team;
  - notifications (EX-04).

## 2. Layer specifications

### API

| Endpoint | Request | Success |
| --- | --- | --- |
| PATCH /api/milestones/:milestoneId | `{title?, description?, dueAt?, lateUntil?: string \| null}` | 200 `{milestone}` |
| POST /api/milestones/:milestoneId/close | No body (an empty or absent body is accepted) | 200 `{milestone}` |

The milestone response adds `lateUntil` (ISO or null), `closedAt` (ISO or null) and `closedBy` (numeric ID or null) to the F-04 fields. `window` can now be `OPEN`, `LATE` or `CLOSED`. These are additive fields, so existing clients keep working.

### Data

The migration is additive (nullable, so existing rows stay valid and no backfill is needed). It adds to `milestones`:
- `late_until timestamp(3) NULL`;
- `closed_at timestamp(3) NULL`;
- `closed_by int NULL` FK to users, ON DELETE RESTRICT.

No CHECK constraint is added, because BR-12 depends on the changing `due_at` and is enforced in the API in one transaction. Seed and fixtures are unchanged. The deploy migration job applies the change before the new revision serves traffic, as in Lab 5.

### UI

**Milestone detail page (`/milestones/:milestoneId`), assigned Supervisor only.** It shows a **Manage milestone** section with:
- an edit form: Title, Description, and Due date and time (Asia/Bangkok), pre-filled;
- a Late window end (Asia/Bangkok) input, with **Remove late window**;
- **Close milestone**, with a confirmation ("Close this milestone? Students can no longer submit.").

It also handles the request states:
- **Save changes** sends only the fields whose value differs from the loaded milestone. The pre-filled due date and late-window end are omitted unless the user changed them.
- Saving disables the section and shows "Saving…".
- Field errors from the server appear beside their inputs, and the values are kept.
- 5xx or network errors show "Could not save the milestone. Please try again.", and the user can retry.
- On success it announces "Milestone updated." or "Milestone closed." and re-renders from the response.

**When the milestone is closed:** due date and late-window inputs are disabled, with "This milestone is closed."

**Badges:** "Window: Late window" and "Window: Closed" (closed by a Supervisor), plus "Late until …" (ICT) when set.

**Students:** they see the same badges and no Manage section. The list page shows the new window badge values.

## 3. Acceptance criteria

| AC | Given | When | Then | Covers |
| --- | --- | --- | --- | --- |
| AC-08.1 | An assigned Supervisor (or co-supervisor) and a milestone of their team | They PATCH a new title and description | 200. The DB and a later GET show the trimmed values. `dueAt`, `lateUntil` and `closedAt` are unchanged | FR-10 |
| AC-08.2 | A milestone due at D, server time `now` | They PATCH `dueAt` | Later than D and ≥ now + 24 h → 200, persisted. ≤ D → 400 BR-13 message. Later than D but < now + 24 h → 400 CR-01 message. Exactly now + 24 h (if > D) → 200. No write on 400 | FR-10, BR-13, BR-05 |
| AC-08.3 | A milestone due at D | They PATCH `lateUntil` | > D and > now → 200 and the window can be `LATE`. = D or earlier → 400 BR-12. ≤ now → 400. `null` → window removed. Extending `dueAt` to ≥ the existing `lateUntil` without a new `lateUntil` → 400. No write on 400 | FR-12, BR-12 |
| AC-08.4 | An open milestone | They POST close | 200, with `closedAt` = server now and `closedBy` = the actor; window `CLOSED`. A second close → 409 `MILESTONE_CLOSED`. On a closed milestone, `dueAt` or `lateUntil` → 409 (no write), while title and description → 200 | FR-11 |
| AC-08.5 | Fixed `dueAt`, `lateUntil` and closed states | The window is evaluated at due − 1 s, due, due + 1 ms, late_until, late_until + 1 ms, and when closed | OPEN, OPEN, LATE, LATE, CLOSED. Closed is `CLOSED` at every time. Team status stays Not submitted / Overdue / Submitted as in Sprint 1, whether or not the milestone is closed | DEC-13, §4.3.1 |
| AC-08.6 | A closed milestone whose deadline is in the future | A team member POSTs a submission | 409 `MILESTONE_CLOSED`, no row. Existing submissions and feedback stay readable | BR-11 |
| AC-08.7 | An anonymous user, a Student (own or other team), an unassigned Supervisor, a malformed or missing ID, malformed JSON | They PATCH, close or DELETE | 401 first, then 403 for wrong role, 404 for hidden scope, then 400 for the body. DELETE → 404 and the row stays. Denied requests write nothing | BR-01–BR-03, BR-14, NFR-02, NFR-03, NFR-05 |
| AC-08.8 | A Supervisor on the detail page | They save valid changes, invalid changes, or hit a 5xx error; they close with confirmation | Busy state; field errors beside inputs with values kept; safe retryable error; success message; closed state disables the date inputs. A Student sees badges only | NFR-10 |

## 4. Software Test Specification

Test levels:
- **U:** Vitest, no database.
- **I:** Supertest against PostgreSQL `cpms_test`, with a fixed `now`.
- **C:** React with mocked fetch.
- **E:** Chromium against the real API and `cpms_e2e`.

| Test ID | AC | Level | Preconditions / inputs | Steps | Expected |
| --- | --- | --- | --- | --- | --- |
| TEST-08.2u | 08.2, 08.3 | U | Fixed now, current D, existing lateUntil; valid, equal, earlier, < now + 24 h, = now + 24 h dueAt; lateUntil = D, D + 1 ms, ≤ now, null; empty body | Call `parseMilestoneUpdate` | Field errors and messages exactly as in §1. Valid input normalized. All errors returned together |
| TEST-08.5u | 08.5 | U | Milestone states: open, with lateUntil, closed (before and after due) | `submissionWindow` at the listed instants; `teamStatus` with and without a submission | Window and team status exactly as in AC-08.5 |
| TEST-08.1i | 08.1 | I | pA and pA2 assigned to A; milestone in A with `lateUntil` set; a second, closed milestone | PATCH title/description; GET detail. Then PATCH **only** `{title}` on each milestone, sending neither date | 200; persisted trimmed values. Title-only saves → 200 on both, and `dueAt`, `lateUntil` and `closedAt` are unchanged in the DB |
| TEST-08.2i | 08.2 | I | Milestone M1 due D = now + 2 d; milestone M2 inserted directly with due now + 1 h | M1: PATCH D + 1 d; D; D − 1 h. M2: PATCH now + 24 h − 1 s; now + 24 h | M1: 200 / 400 BR-13 / 400 BR-13. M2: 400 CR-01 / 200. `dueAt` checked in the DB after every request |
| TEST-08.3i | 08.3 | I | Milestone due D | PATCH lateUntil L = D + 1 h; lateUntil D; then, **while L still exists**, dueAt L + 1 s; then lateUntil null | 200 / 400 BR-12 / 400 (extension past the window) with `dueAt` and `lateUntil` unchanged / 200 with the window cleared; DB checked after each request |
| TEST-08.4i | 08.4 | I | Open milestone | POST close twice; PATCH dueAt; PATCH title | 200 with server `closedAt`/`closedBy`; 409; 409 with no change; 200 |
| TEST-08.6i | 08.6 | I | Closed milestone with future due; another closed milestone with an existing submission and feedback | sA POSTs a submission; GET submission and feedback | 409 `MILESTONE_CLOSED`, count unchanged; existing data readable |
| TEST-08.7i | 08.7 | I | Anonymous, sA, sB, sC (no team), pB (unassigned), malformed ID, malformed JSON | PATCH / close / DELETE each | Fixed 401 → 403 → 404 → 400 order, identical 404 body, no writes; DELETE 404 and the row remains |
| TEST-08.9i | 08.6 | I | mA: the team has a submission, and mA is closed with a future due date; mB: the team has a submission, not closed, future due | sA POSTs to each | mA → 409 `MILESTONE_CLOSED` (close wins over the duplicate); mB → 409 `ALREADY_SUBMITTED` (unchanged). No new rows |
| TEST-08.10i | 08.2, 08.3, 08.6 | I | Real concurrency. A second database transaction locks the milestone row, changes it, and holds the lock for about 300 ms before committing, while the service function under test runs: (a) the holder extends `dueAt` to X; `updateMilestone` sets `lateUntil` between the old due date and X. (b) The holder extends `dueAt` to X; `updateMilestone` sets `dueAt` to Y, with old < Y < X. (c) The holder closes the milestone; `createSubmission` inserts | (a) 400 `fields.lateUntil` (BR-12), and the row keeps `lateUntil` null with `dueAt` = X. (b) 400 BR-13, and `dueAt` stays X. (c) 409 `MILESTONE_CLOSED` and no submission row. In each case the final row satisfies `lateUntil` null or > `dueAt`, and `dueAt` ≥ the original |
| TEST-08.8c | 08.8 | C | Supervisor detail page with mocked responses (200, 400 fields, 500, closed); Student page | Edit, save, retry, confirm close | Busy state; field errors beside inputs; values kept; success message; closed disables dates; Student sees no Manage section |
| TEST-08.1e | 08.1, 08.3, 08.4, 08.6 | E | "E2E Lifecycle Team" with its own Student. The fixture also seeds "F08 late milestone" with `dueAt` 1 day ago and `lateUntil` 1 day ahead | (a) Supervisor creates a milestone, edits its title, extends the due date by days and sets a late window; reloads. (b) Supervisor closes it and reloads. (c) The Student opens it. (d) The Student opens "F08 late milestone" | (a) Values persist; the window stays **Open** (the deadline is still ahead) and "Late until …" shows. (b) "Window: Closed" after reload. (c) "Window: Closed", "This milestone is closed.", no submit form, no Manage section. (d) "Window: Late window" |

**Updated existing tests.** None is deleted or weakened, and their other expected results don't change:
- TEST-04.4u and TEST-05.3a call `submissionWindow` with the milestone instead of `dueAt` (signature change only).
- TEST-04.1i and the F-05 `MILESTONE_KEYS` assertion list the three new response fields `lateUntil`, `closedAt` and `closedBy` (additive API change, §2).
- The E2E fixture (`server/scripts/e2e-prepare.ts`) adds its own "E2E Lifecycle Team" and Student, so TEST-08.1e never adds rows to the F-04 teams that TEST-04.1e and TEST-04.2e expect to be empty. It also seeds "F08 late milestone" directly in the database, already inside its late window, because the API can't create a past due date.

**Commit order:**
1. contract (this PR, reviewed);
2. additive migration, the behavior-preserving `submissionWindow(milestone, now)` signature change, and a `parseMilestoneUpdate` interface stub that always returns 501, so the new tests fail on behavior rather than on a missing import;
3. tests, with a RED run on that commit;
4. implementation, with a GREEN run;
5. full regression: server, client, Docker in CI, and local Playwright.

## 5. Definition of Done

- [ ] Contract v0.1 reviewed and approved by @Earth2509 before the migration, tests and code.
- [ ] Additive migration; existing rows and seed unaffected; migration job succeeds on deploy.
- [ ] API, window model and UI above implemented; F-04 and F-05 callers updated; no unrelated changes.
- [ ] RED and GREEN runs recorded with commands, commit IDs and counts. RED fails on the missing behavior, not on compile errors.
- [ ] Server, client and Docker checks pass in CI. Local Playwright passes. Nothing skipped or weakened.
- [ ] Traceability (FR-10, FR-11, FR-12, BR-11–BR-14) and the feature inventory updated.
- [ ] PR reviewed and approved by @Earth2509, merged into `staging/sprint-2`; released to `main` in `v0.5.0` and checked on the deployed app.
