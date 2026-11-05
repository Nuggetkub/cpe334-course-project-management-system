# F-05 Submit milestone work — Engineering Contract

**Issue:** #10 · **Branch:** `feature/F-05-submission` · **Sprint:** 1 · **Owner:** @Nuggetkub · **Reviewer:** @Earth2509
**Requirements:** FR-13, FR-14, FR-09 (team status "Submitted") · BR-03, BR-06, BR-07, BR-09 · NFR-03, NFR-05, NFR-06, NFR-10
**Decisions:** DEC-03 (server-time deadline), DEC-04 (one submission in Sprint 1, versions in Sprint 2), DEC-10 (cross-team → 404), DEC-13 (window vs team status, SRS §4.3.1) · **Traceability:** [traceability.md](../../traceability.md)

| Version | Date | Author | Reviewer | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-04 | @Nuggetkub | @Earth2509 | Contract committed before implementation. Depends on F-04's Milestone model (§1.3), which is not yet merged |
| 0.2 | 2026-11-05 | @Nuggetkub | @Earth2509 | Aligned with F-04 as delivered in #35 (this branch is stacked on it): the GET returns F-04's milestone shape with the real `teamStatus`; F-04's list and detail endpoints also report *Submitted* (TEST-05.8c added); the page extends F-04's `MilestonePage.tsx`; E2E uses its own team and a second E2E student so F-04's empty-list browser test is unaffected. STS 22 rows |

---

## 1. Feature design

### 1.1 Behaviour

A **Student** opens one of their team's milestones and, while its window is **Open** (server time
`now ≤ due_at`), submits a **title**, an optional **description** and a **link** to the work (hosted
elsewhere, AS-03). The server stores it as **version 1** with the submitter and the server time. In
Sprint 1 a team has **at most one submission per milestone** (BR-07): any later attempt by any
member is rejected with 409, and so is any attempt after the deadline (BR-06).

Every member of the team and every Supervisor assigned to the team can then see the persisted
submission: title, description, link, who submitted it and when (shown in Asia/Bangkok time,
NFR-06). Before anything is submitted they see "Not submitted yet" (AC-05.7). The team status
changes from *Not submitted*/*Overdue* to *Submitted* and stays *Submitted* after the deadline
(SRS §4.3.1).

This is the domain transaction of the Sprint 1 journey (D1 §2): F-04 milestone → **F-05 submission**
→ F-06 feedback.

### 1.2 Workflow

```
Milestone page (/milestones/:milestoneId)
  └─ GET /api/milestones/:id/submission ─► requireAuth → ownership (milestone's team) ─✗─► 401 / 404
         │✓
         ▼
     { milestone {…F-04 fields, window, teamStatus}, submission | null }
         │
         ├─ submission present ─────────────► show it (read-only), team status "Submitted"
         ├─ none, window Closed ────────────► "Not submitted yet" + "The deadline has passed."
         └─ none, window Open, role Student ─► submission form
                                                  │ client validation ─✗─► field messages, no request
                                                  ▼
POST /api/milestones/:id/submissions
  requireAuth ─✗─► 401
  requireRole("STUDENT") ─✗─► 403 FORBIDDEN
  load milestone → assertTeamAccess(milestone.teamId) ─✗─► 404 NOT_FOUND (missing, other team, no team)
  jsonBody ─✗─► 400 BAD_REQUEST
  validate title / description / link ─✗─► 400 VALIDATION_ERROR + fields
  now = clock()   (one instant for the check and the stored time)
  team already has a submission ─► 409 ALREADY_SUBMITTED
  now > due_at ─► 409 DEADLINE_PASSED
  INSERT submission(version 1, submitted_by, submitted_at = now)
        └─ unique (milestone_id, version) violated by a concurrent request ─► 409 ALREADY_SUBMITTED
  201 { submission }
```

The guard order is F-02's: **401 → 403 → 404 → 400**, then the business rules (409). Checking the
duplicate before the deadline gives a team that already submitted the more useful message after
the deadline too.

### 1.3 Dependencies

| Depends on | Why | State |
|---|---|---|
| F-01 (#6) | `requireAuth`, `req.user`, NFR-05 error helpers, `apiFetch` / `ApiError` on the client | Merged |
| F-02 (#7) | `requireRole`, `assertTeamAccess`, `parseId`, `jsonBody`, protected-endpoint list, `expectForbidden` / `expectHidden` | Merged |
| F-03.1 (#8) | `teams`, `team_members`, `supervisor_teams` | Merged |
| **F-04 (#9)** | **`Milestone` model** with at least `id`, `team_id` (FK → teams), `title`, `description`, `due_at` (`timestamp(3)`, UTC); the milestone list page links each milestone to `/milestones/:milestoneId`; the window rule "Open while `now ≤ due_at`" | **Provided by #35** (F-04 v0.1): `Milestone` (also `createdBy`, `createdAt`), `status.ts`, `createApp({ now })`, `formatBangkok`, the list links and the read-only `MilestonePage.tsx`. This branch is stacked on F-04's branch until #35 merges |
| — | F-06 attaches feedback to `submissions.id` (BR-10) | Provided by this feature |

**Shared with F-04.** The two status rules live in one server module,
`server/src/milestones/status.ts`, so the deadline is implemented once:

- `submissionWindow(dueAt, now)` returns `"OPEN" | "CLOSED"` (Sprint 1 rows of §4.3.1). F-04 creates it; F-05 uses it for BR-06.
- `teamStatus(dueAt, hasSubmission, now)` returns `"SUBMITTED" | "NOT_SUBMITTED" | "OVERDUE"`. F-04 creates it without submissions; F-05 adds the `SUBMITTED` row and makes F-04's milestone list **and** detail endpoints pass the real value.

Whoever lands first creates the module; the other extends it. The same applies to the client time
formatter `client/src/time.ts` (`formatBangkok(iso)` → e.g. `8 Nov 2026, 23:59 (ICT)`).

### 1.4 Business rules, validation and boundaries

| Rule | Detail |
|---|---|
| Who may submit | A **Student who is a member of the milestone's team** (BR-03). Supervisors → 403 even on assigned teams (BR-01: submitting is the team's act). Other teams, students with no team, missing or malformed milestone IDs → 404, identical body (DEC-10) |
| Deadline (BR-06, NFR-06) | Accepted while `now ≤ due_at`, so a submission **at exactly `due_at`** is accepted and one at `due_at + 1 ms` is rejected. `now` is the **server** clock read once per request; the client never sends a time and any `submittedAt` in the body is ignored. Precision is milliseconds, as stored (`timestamp(3)`) |
| One per team (BR-07) | At most one submission per milestone in Sprint 1. Enforced in the API **and** by the database (`UNIQUE (milestone_id, version)` with `version = 1`), so two members submitting at the same moment cannot both succeed |
| Title (BR-09) | Required string; surrounding spaces trimmed; 1–120 characters after trimming |
| Description (BR-09) | Optional string (missing → `""`); trimmed; at most 2000 characters |
| Link (BR-09) | Required string; trimmed; at most 2048 characters; must parse as an **absolute URL with scheme `http:` or `https:`** and a host. `example.com`, `/work`, `ftp://…`, `javascript:…`, `https://` → rejected. Reachability is not checked (AS-03) |
| Unknown body fields | Ignored (`version`, `submittedBy`, `submittedAt`, `teamId` can't be set by the client) |
| Field messages | `title`: "Enter a title (1–120 characters)." · `description`: "Description must be at most 2000 characters." · `link`: "Enter a full link starting with http:// or https://." |
| Conflict messages | `ALREADY_SUBMITTED`: "Your team has already submitted work for this milestone." · `DEADLINE_PASSED`: "The deadline for this milestone has passed." |
| Immutability | Sprint 1 has no edit or delete. A submission row is never updated (F-09 adds version N+1 in Sprint 2 instead, BR-08) |

**Out of scope (disclosed):** resubmission and version history (F-09, Sprint 2); late window and
"Late" marking (F-08/F-09); manual close (F-08); file upload (links only, AS-03); checking that the
link is reachable.

### 1.5 Permissions

| Endpoint | Unauth. | Student, own team | Student, other team / no team | Supervisor, assigned | Supervisor, unassigned |
|---|---|---|---|---|---|
| `POST /api/milestones/:milestoneId/submissions` | 401 | ✓ (rules in §1.4) | 404 | 403 | 403 |
| `GET /api/milestones/:milestoneId/submission` | 401 | ✓ | 404 | ✓ | 404 |

Matches the F-02 matrix (§1.5 there). Both endpoints are added to
`server/tests/support/protected-endpoints.ts`.

---

## 2. Layer specifications

### 2.1 API

Errors use the NFR-05 shape. Timestamps are ISO 8601 UTC strings.

| Method + path | Request | Success | Errors |
|---|---|---|---|
| `POST /api/milestones/:milestoneId/submissions` | Bearer; `{ "title": string, "description"?: string, "link": string }` | **201** `{ "submission": Submission }` | 401 · 403 `FORBIDDEN` · 404 `NOT_FOUND` · 400 `BAD_REQUEST` (malformed JSON) · 400 `VALIDATION_ERROR` + `fields` · 409 `ALREADY_SUBMITTED` · 409 `DEADLINE_PASSED` |
| `GET /api/milestones/:milestoneId/submission` | Bearer | **200** `{ "milestone": Milestone, "submission": Submission \| null }`, where `Milestone` is F-04's shape `{ id, teamId, title, description, dueAt, createdBy, createdAt, window: "OPEN" \| "CLOSED", teamStatus: "SUBMITTED" \| "NOT_SUBMITTED" \| "OVERDUE" }` | 401 · 404 `NOT_FOUND` |

```json
"Submission": {
  "id": 7, "milestoneId": 3, "version": 1,
  "title": "Week 1 prototype", "description": "Login and team view", "link": "https://github.com/org/repo",
  "submittedAt": "2026-11-08T16:59:59.000Z",
  "submittedBy": { "id": 12, "name": "Demo Student 1" }
}
```

"No submission yet" is `200` with `submission: null`, not a 404, so it can't be confused with a
hidden milestone. `submittedBy` has only `id` and `name`.

Server modules: `server/src/submissions/routes.ts` (router), `server/src/submissions/validate.ts`
(`parseSubmission(body)` → value or `HttpError` 400), and the shared `server/src/milestones/status.ts`.
`createApp({ now })` (from F-04) stores the clock as `app.locals.now`, so integration tests can fix
it at `due_at ± 1 s`; production never sets it. F-04's `GET /api/teams/:teamId/milestones` and
`GET /api/milestones/:milestoneId` keep their response shape but report `teamStatus: "SUBMITTED"`
once the milestone has a submission (TEST-05.8c).

### 2.2 Data

Additive migration `add_submissions` (no change to existing tables, safe for a Cloud Run rollback):

| Table `submissions` | Type | Constraint |
|---|---|---|
| `id` | serial | PK |
| `milestone_id` | int | FK → `milestones.id`, `ON DELETE RESTRICT` (BR-14: a milestone with submissions is never deleted) |
| `version` | int | not null, default 1 (always 1 in Sprint 1; F-09 allocates N+1) |
| `title` | varchar(120) | not null |
| `description` | varchar(2000) | not null, default `''` |
| `link` | varchar(2048) | not null |
| `submitted_by` | int | FK → `users.id`, `ON DELETE RESTRICT` |
| `submitted_at` | timestamp(3) | not null; the server instant used for the deadline check |

`UNIQUE (milestone_id, version)` enforces BR-07 in Sprint 1 and unique versions in Sprint 2.

There is **no `team_id` column**: a milestone belongs to exactly one team, so a submission's team is
`milestone.team_id`, and ownership checks resolve through it (a second copy could disagree). The demo
seed is unchanged (no demo submissions), so the journey can be shown from an empty state.

### 2.3 UI

Route `/milestones/:milestoneId` (`client/src/pages/MilestonePage.tsx`, F-04's read-only page),
reached from F-04's milestone list. F-05 switches the page to the submission GET, so one request
loads both the milestone and its submission. One component renders for both roles.

| Element | Behaviour |
|---|---|
| Header | Milestone title and description (F-04's fields); "Due 8 Nov 2026, 23:59 (ICT)" (`formatBangkok`); window badge (*Open* / *Closed*) and team status badge (*Submitted* / *Not submitted* / *Overdue*) as two separate values (DEC-13) |
| Loading (AC-05.7) | "Loading submission…" (`role="status"`) while the GET is in flight |
| Empty (AC-05.7) | No submission: "Not submitted yet". If the window is Closed, also "The deadline has passed." |
| Submission view (AC-05.5) | Title, description, link (`<a href>` with `target="_blank" rel="noopener noreferrer"`; only http/https links are ever stored), "Submitted by {name} on {formatBangkok(submittedAt)}" |
| Form (Student, none submitted, window Open) | Fields *Title*, *Description* (optional), *Link*; button **Submit** → "Submitting…" and disabled while in flight |
| Client validation (AC-05.2) | Same rules and messages as §1.4, shown under each field; no request sent while invalid |
| Server 400 (AC-05.2) | `fields` from the response are shown under the matching inputs |
| Server 409 / 5xx / network (AC-05.6) | Banner (`role="alert"`) with the server's message for 409; "Could not submit. Please try again." for 5xx or network. Entered values are kept; the button is re-enabled |
| Success | The page shows the returned submission and the team status *Submitted*; the form is gone |
| 404 on load | "Milestone not found." No data from the response is shown |
| Load failure (5xx / network) | "Could not load this milestone." with a **Retry** button |
| Supervisor | Same page, read-only: never shows the form |

### 2.4 Configuration

None. The clock option is code-only (tests); there is no environment variable for it.

---

## 3. Acceptance criteria

AC-05.1–AC-05.7 are fixed in [traceability.md](../../traceability.md) (wording made precise here);
AC-05.8 and AC-05.9 are added by this contract.

| AC | Given / When | Then (observable) | Req |
|---|---|---|---|
| AC-05.1 | A Student of the milestone's team posts a valid title, description and link while the window is Open | 201 with the submission; one row with `version = 1`, `submitted_by` = that student, `submitted_at` = server time; a later GET returns it | FR-13 |
| AC-05.2 | Title empty or over 120 characters after trimming, description over 2000, or a link that is not an absolute http/https URL | 400 `VALIDATION_ERROR` with a message per bad field, no row stored; the form shows the same messages under the fields, and checks them before sending | BR-09, NFR-10 |
| AC-05.3 | Server clock at `due_at − 1 s`, at `due_at`, at `due_at + 1 s` | First two → 201; third → 409 `DEADLINE_PASSED`, no row. Any time sent by the client is ignored | BR-06, NFR-06 |
| AC-05.4 | The team already has a submission (also: two members submitting at the same moment) | Later attempt → 409 `ALREADY_SUBMITTED`; exactly one row exists | BR-07 |
| AC-05.5 | Members of the team and its assigned Supervisors open the milestone; anyone else does | Members and assigned Supervisors see the same submission with submitter name and time; another team's Student, a Student with no team or an unassigned Supervisor → 404, identical to a nonexistent milestone, no data | FR-14, BR-02, BR-03 |
| AC-05.6 | The submit request fails with 409, 5xx or a network error | The form shows the server message (409) or "Could not submit. Please try again."; title, description and link keep their values; the user can retry | BR-06, BR-07, NFR-10 |
| AC-05.7 | The milestone page is loading; the team has no submission | "Loading submission…" while fetching; then "Not submitted yet" | FR-14, NFR-10 |
| AC-05.8 | Team status per SRS §4.3.1 Sprint 1 rows, on the milestone page and in F-04's list and detail | No submission and `now ≤ due_at` → Not submitted; no submission and `now > due_at` → Overdue; a submission → Submitted, before and after the deadline | FR-09, DEC-13 |
| AC-05.9 | A Supervisor (assigned or not) posts a submission; checks combined | 403 `FORBIDDEN`, no row; a malformed or invalid body to another team's milestone → 404, not 400 (401 → 403 → 404 → 400 → 409) | BR-01, NFR-03 |

---

## 4. Software Test Specification

Levels: **U** = unit (Vitest, no DB) · **I** = API + DB integration (Vitest + Supertest, `cpms_test`,
clock fixed through `createApp({ now })`) · **C** = client component (Vitest + Testing Library,
`fetch` mocked) · **E** = end-to-end (Playwright, real API + DB in `cpms_e2e`).

Fixture: F-02's `createTeamsFixture` plus a second member **sA2** of team A (created in the test file),
a milestone **mA** of team A (`due_at = 2026-11-08T16:59:59.000Z`, created by pA) and **mB** of team B,
inserted directly (F-04's API is not used, so these tests don't depend on F-04's validation).

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-05.2a | AC-05.2 | U | — | `parseSubmission` with title `""`, `"   "`, 1 char, 120 chars, 121 chars, `"  x  "`; description missing, 2000, 2001; link `https://a.b/c`, `http://a.b`, `example.com`, `/work`, `ftp://a.b`, `javascript:alert(1)`, `https://`, 2049 chars; non-string values; extra `submittedAt` | Accepts exactly the valid ones (trimmed, description defaults to `""`, extra fields dropped); each invalid one gives its field message |
| TEST-05.3a | AC-05.3 | U | `due = 2026-11-08T16:59:59.000Z` | `submissionWindow(due, now)` at `due − 1 s`, `due`, `due + 1 ms`, `due + 1 s` | OPEN, OPEN, CLOSED, CLOSED |
| TEST-05.8a | AC-05.8 | U | Same `due` | `teamStatus(due, false, due)`, `(due, false, due + 1 s)`, `(due, true, due − 1 s)`, `(due, true, due + 1 day)` | NOT_SUBMITTED, OVERDUE, SUBMITTED, SUBMITTED |
| TEST-05.1 | AC-05.1 | I | sA signed in; clock `due − 1 h` | POST to mA with valid body, then GET as sA | 201 body matches §2.1; one row: version 1, `submitted_by = sA`, `submitted_at = clock`; GET returns the same submission and `teamStatus: "SUBMITTED"` |
| TEST-05.1b | AC-05.1 | I | sA signed in | POST with extra `submittedAt: "2000-01-01T00:00:00Z"`, `version: 9`, `submittedBy: <pB id>` | 201; stored values are the server's (clock, 1, sA); response keys contain no `password`/`passwordHash`/`email` |
| TEST-05.2b | AC-05.2 | I | sA signed in | POST each invalid body from TEST-05.2a | 400 `VALIDATION_ERROR` with the expected `fields` keys; no row |
| TEST-05.3b | AC-05.3 | I | Three fresh team-A milestones with the same `due` | POST with clock at `due − 1 s`, at `due`, at `due + 1 s` | 201, 201, 409 `{error:{code:"DEADLINE_PASSED",…}}`; the third milestone has no row |
| TEST-05.4a | AC-05.4 | I | sA has submitted to mA | sA2 (teammate) POSTs to mA; sA POSTs again | Both 409 `ALREADY_SUBMITTED`; exactly one row |
| TEST-05.4b | AC-05.4 | I | Nothing submitted to mA | sA and sA2 POST at the same moment (`Promise.all`) | One 201 and one 409 `ALREADY_SUBMITTED`; exactly one row |
| TEST-05.5a | AC-05.5, AC-05.7 | I | Before and after sA submits to mA | GET as sA, sA2, pA, pA2 | Before: `submission: null`, `teamStatus: "NOT_SUBMITTED"`; after: all four get the same submission with `submittedBy {id,name}` of sA |
| TEST-05.5b | AC-05.5 | I | sA has submitted to mA | GET mA as sB, s0, pB; GET `/api/milestones/999999/submission` as sB; POST mA as sB and s0 | All 404 with the fixed `NOT_FOUND` body (`expectHidden`); still one row |
| TEST-05.8b | AC-05.8 | I | mA with no submission; clock `due + 1 s` | GET as sA; then sA submits to a second milestone before its due, and GET after it | `OVERDUE` / window `CLOSED`; then `SUBMITTED` with the clock past that due |
| TEST-05.8c | AC-05.8 | I | sA has submitted to mA; mA2 of team A has no submission; clock `due + 1 s` | GET F-04's `/api/teams/:teamId/milestones` and `/api/milestones/:mA` as sA | mA `SUBMITTED`, mA2 `OVERDUE` in the list; detail of mA `SUBMITTED`; response keys unchanged |
| TEST-05.9a | AC-05.9 | I | pA (assigned) and pB signed in | POST valid body to mA | 403 for both (`expectForbidden`); no row |
| TEST-05.9b | AC-05.9 | I | sB signed in | POST to mA with malformed JSON, and with `{title:""}` | 404 for both (ownership before parsing and validation) |
| TEST-02.1 (extended) | AC-02.1 | I | Both F-05 endpoints added to the protected-endpoint list | The existing loop | 401 for every bad header; POST with a malformed body and no token → 401 |
| TEST-05.2c | AC-05.2 | C | Student, window Open, `fetch` spied | Submit empty form; then title filled and link `example.com` | Title and link messages shown; `fetch` (POST) not called |
| TEST-05.2d | AC-05.2 | C | POST returns 400 with `fields.link` | Submit | Server message shown under *Link* |
| TEST-05.6 | AC-05.6 | C | POST returns 409 `DEADLINE_PASSED`; then 500; then rejects (network) | Submit each time | Banner with the server message / "Could not submit. Please try again." (twice); all three values kept; button enabled |
| TEST-05.7 | AC-05.5, AC-05.7, AC-05.8 | C | GET pending; then `submission: null`; then a submission at `2026-11-08T16:59:59Z` | Render the page | "Loading submission…"; then "Not submitted yet" and the form; then title, link with `href` and `rel="noopener noreferrer"`, "Submitted by …" with `8 Nov 2026, 23:59 (ICT)`, badge *Submitted* and no form |
| TEST-05.1e | AC-05.1, AC-05.5 | E | `e2e-prepare` adds `student2@e2e.test` in a new "E2E Submission Team" (the E2E supervisor is assigned) with a milestone due in 7 days. A separate team keeps F-04's empty-list browser test valid | Student signs in → opens the milestone → submits → reloads → logs out; Supervisor signs in → opens the milestone | Student sees the submission after the reload; Supervisor sees the same title, link and submitter, and no form |
| TEST-05.3e | AC-05.3, AC-05.6 | E | `e2e-prepare` adds a milestone of the same team that is already past due. Playwright rewrites only the **GET** response so the page thinks the window is Open | Student fills the form and submits | The real server answers 409; the banner reads "The deadline for this milestone has passed."; values kept. Shows the deadline is enforced by the server, not the page |

**Count (v0.2):** 22 STS rows: 3 unit (U), 13 API+DB integration (I, including the extended
TEST-02.1), 4 client component (C), 2 end-to-end (E). Several rows expand into one case per input.

**TDD evidence:** commit order on this branch is (1) this contract, (2) the `submissions` migration
so the red run fails on behaviour rather than on a missing table, (3) failing tests TEST-05.x with
the red run recorded in the PR, (4) implementation (green run). The deadline and duplicate rules
(TEST-05.3a/b, TEST-05.4a/b) must be seen failing before the code exists.

---

## 5. Definition of Done

- [x] F-04's Milestone model is merged (or this branch is stacked on it), and §1.3's shared modules agree with F-04. Stacked on #35.
- [x] Behaviour in §1–§2 implemented in API, DB (additive migration) and UI.
- [x] Every test in §4 exists, was seen **failing before** its implementation, and passes; red and
      green runs (command, counts, commit SHA) are in §6 and the PR.
- [x] `server`: `npm run typecheck`, `npm test`; `client`: `npm test`, `npm run build`; root:
      `npm run e2e` — all pass on the PR head. No test skipped, disabled or weakened.
- [x] Both endpoints are in the protected-endpoint list; F-02's suite still passes.
- [x] README API table lists the two endpoints.
- [x] `traceability.md` updated: AC-05.1–05.7 wording, AC-05.8 and AC-05.9 added, change-log row (v0.8, v0.11).
- [ ] Reviewed and approved by @Earth2509 with a specific check recorded; merged into `staging/sprint-1`.
- [x] Known limitations disclosed: no resubmission, late window or manual close until Sprint 2.

---

## 6. Implementation and verification record

Branch `feature/F-05-submission`, stacked on F-04 (`3be187d` merges `feature/9-f04-milestones` at
`8adf0b1` into staging `e3420eb`). Commit order: contract v0.2 `5c093ec` → migration `91ab4e1` →
failing tests `b5321a0` → implementation `bdbf2fc`. Local PostgreSQL 16 (Docker), Node 24.

### Red at `b5321a0` (migration present, no F-05 code)

| Command | Result |
|---|---|
| `npm --prefix server test` | 33 failed / 130 passed. `submissions.test.ts` **22/22 failed on behaviour**: `expected 404 to be 201/400/403/200` (routes not mounted), `[404, 404]` instead of `[201, 409]` (TEST-05.4b), `OVERDUE`/`NOT_SUBMITTED` instead of `SUBMITTED` (TEST-05.8c). TEST-02.1: 9 failed (404 instead of 401 for the two new endpoints). TEST-05.8a: 2 failed (`teamStatus` ignored the submission). `submissions-validate.test.ts` failed to **load** (`parseSubmission` did not exist); this is not claimed as behavioural red. TEST-05.3a passed already: F-04 had implemented the shared window rule |
| `npm --prefix client test` | 7/7 new TEST-05.x failed (F-04's read-only page); 38 existing passed |
| `npm run e2e` | TEST-05.1e and TEST-05.3e failed; the four F-01/F-04 journeys passed with the new "E2E Submission Team" fixture |

### Green at `bdbf2fc`

| Command | Result |
|---|---|
| `npm --prefix server test` | **180/180**, 13 files |
| `npm --prefix server run typecheck` / `build` | pass / pass |
| `npm --prefix client test` | **45/45**, 6 files |
| `npm --prefix client run build` | pass |
| `npm run e2e` | **6/6** (TEST-01.7b, 01.8b, 04.1e, 04.2e, 05.1e, 05.3e) |
