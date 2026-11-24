# F-11 Student progress board. Engineering Contract

**Issue:** #84 · **Owner:** @Nuggetkub (moved from @Earth2509 to balance D2) · **Reviewer:** @Earth2509 · **Branch:** `feature/84-f11-progress-board`

**Requirements:** FR-22, BR-03, BR-04, BR-15, DEC-06, DEC-10, DEC-13, NFR-03, NFR-05, NFR-06, NFR-09, NFR-10.

**Depends on:** F-04 (milestones), F-06 (feedback), F-08 (window), F-09 (versions and Late), F-10 (grades and release).

**Baseline:** SRS v0.3; F-08 contract v0.4; F-09 contract v0.3; F-10 contract (pending, #83).

| Version | Date | Author | Reviewer | Change |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-11-25 | @Nuggetkub | @Earth2509 | Contract and planned tests, before any F-11 test or code |

## 1. Feature design

A Student opens **Progress** and sees one row per milestone of their team. The row shows:
- the window and the team status, computed by the existing F-08/F-09 status functions;
- the **latest version** (number, time, and whether it's Late);
- the **feedback status** of that latest version;
- the **released grade**, or "Not released".

The board only reads data, and it never shows anything another page couldn't show the same user.

**Grade column and F-10.** The released grade comes from F-10 (#83).
- **Phase 1 (D2 target):** this contract can be implemented and tested on everything except the grade (AC-11.1, 11.2, 11.4–11.6). The grade column reports "Not released" for every row, because nothing can be released before F-10 exists.
- **Phase 2:** once F-10 is merged, the same endpoint reads F-10's released grade. AC-11.3 is tested then.

D2 reports AC-11.3 as **planned**, not done, unless F-10 merges first.

### Workflow and authorization

`GET /api/teams/:teamId/progress?page=N` runs requireAuth (401) → requireTeamAccess (404, the fixed F-02 body) → page validation (400) → one scoped query → 200.

| Caller | Result |
| --- | --- |
| Anonymous | 401 |
| Student, own team | 200 |
| Student, other team or no team | 404 |
| Assigned Supervisor or co-supervisor | 200 (read-only; F-12 is their main view) |
| Other Supervisor | 404 |

The UI finds the Student's team through the existing `GET /api/teams/mine`. A Student with no team sees the existing FR-05 empty state ("You are not assigned to a team yet").

### Row rules (server-side, one server instant per response)

| Field | Rule |
| --- | --- |
| `window`, `teamStatus` | Exactly the values F-04/F-08/F-09 return for the same milestone at the same instant (DEC-13); the same functions are reused |
| `latest` | The highest version: `{version, late, submittedAt}`, or `null` when there's no submission |
| `feedbackStatus` | `NONE` when `latest` is null. `RECEIVED` when the latest version has at least one feedback entry. `AWAITING` when the latest version has none, even if an older version had feedback (BR-10: feedback belongs to its version) |
| `grade` | `{released: true, score}` only when F-10 says the milestone's grades are released for this team (BR-15, DEC-06). Otherwise `{released: false}`, with **no score field at all**, so an unreleased value can't leak through the API |

Rows are ordered by `dueAt` ASC, then `id` ASC, with 50 per page, like F-04.

### Dependencies and scope
- **Reuses:** `submissionWindow`, `teamStatus` and `presentMilestone`'s status logic; the F-02 guards; the `formatBangkok` UI helper.
- **No schema change:** it only reads milestones, submissions, feedback and (after F-10) grades.
- **Out of scope:** writing anything; other teams; filters (F-12); CSV (F-13).

## 2. Layer specifications

### API

| Endpoint | Success |
| --- | --- |
| GET /api/teams/:teamId/progress?page=N | 200 `{team: {id, name}, rows, page, pageSize: 50, total}` |

Each row is `{milestoneId, title, dueAt, window, teamStatus, latest, feedbackStatus, grade}`. An empty team is 200 with `rows: []`.

- **Errors:** 401, 404 (fixed body), 400 `VALIDATION_ERROR` on `fields.page` (only after the ownership check).
- **Query shape:** one query for the page of milestones, with the latest submission (`take: 1` by version desc) and a feedback count for that version, plus one count. No per-row queries. NFR-09's method covers it in Sprint 3.

### Data

No migration. Reads only.

### UI

A new route `/progress` and a **Progress** navigation link for Students.
- **Table:** Milestone (links to `/milestones/:id`) | Due (ICT) | Window | Team status | Latest version | Feedback | Grade.
  - "Latest version" shows "Version N" plus a **Late** badge, or "Not submitted".
  - Feedback shows "Feedback received", "Awaiting feedback" or "—".
  - Grade shows the score or "Not released".
- **States:** loading "Loading progress…"; empty "No milestones yet"; error "Could not load progress." with **Retry**; no-team empty state; Previous/Next pages.
- On narrow screens, the table turns into stacked rows with the same labels.

## 3. Acceptance criteria

| AC | Given | When | Then | Covers |
| --- | --- | --- | --- | --- |
| AC-11.1 | A Student of team A. Milestones: no submission and due in the future; no submission and overdue; submitted on time; latest version Late; closed by a Supervisor | They open Progress | One row per milestone of team A only, ordered by due date, with the same window and team status as the milestone page | FR-22, DEC-13 |
| AC-11.2 | A milestone with versions 1 and 2, and feedback only on version 1 | They read the row | Latest is version 2 with its Late flag, and feedback status is `AWAITING`. After feedback is added to version 2 it becomes `RECEIVED` | FR-22, BR-10 |
| AC-11.3 (phase 2, after F-10) | A grade recorded but not released, then released | They read the row before and after release | Before: `{released: false}`, with no score in the JSON. After: `{released: true, score}` | FR-22, BR-15, DEC-06 |
| AC-11.4 | An anonymous user, a Student of team B, a Student with no team, an unassigned Supervisor, a malformed or missing team ID | They GET team A's progress | 401, then the fixed 404 for hidden or missing scope. No other team's data appears | BR-03, BR-04, NFR-03 |
| AC-11.5 | Team A has 51 milestones, some with tied due dates | They request pages 1 and 2, and an invalid page | 50 + 1 rows in dueAt/id order with `total` 51. An invalid page → 400 after the ownership check | NFR-09, NFR-10 |
| AC-11.6 | The board is loading, empty, failed or the Student has no team | They open Progress | Loading, empty, error with Retry, and no-team states are shown; Retry recovers | NFR-10 |

## 4. Software Test Specification

Levels as in F-08: **U** (Vitest), **I** (Supertest against PostgreSQL `cpms_test` with a fixed clock), **C** (React with mocked fetch), **E** (Chromium against `cpms_e2e`).

| Test ID | AC | Level | Preconditions / inputs | Steps | Expected |
| --- | --- | --- | --- | --- | --- |
| TEST-11.2u | 11.2, 11.3 | U | Latest null; latest with 0 or 1+ feedback; older-version-only feedback; grade unreleased or released | Call `progressRow(...)` | `feedbackStatus` and `grade` exactly as in §1; no `score` key when unreleased |
| TEST-11.1i | 11.1 | I | Team A with the five milestone states from AC-11.1, team B with one milestone, fixed clock | GET A's progress as sA; GET the F-04 list as sA | Only A's rows, in order. `window` and `teamStatus` equal the F-04 list values row by row |
| TEST-11.2i | 11.2 | I | Versions 1 and 2, feedback on version 1 | GET; then add feedback to version 2 and GET again | Latest is version 2; `AWAITING`, then `RECEIVED` |
| TEST-11.4i | 11.4 | I | Anonymous, sB, s0, pB, malformed or missing ID | GET A's progress | 401, then the fixed 404 ×4. Response bodies contain no team A titles |
| TEST-11.5i | 11.5 | I | 51 milestones in A with tied due dates | GET page 1, page 2, page 0, page `abc` | 50 + 1 rows, stable order, total 51; 400 for an invalid page |
| TEST-11.6c | 11.6 | C | Mocked deferred, empty, failing-then-recovering responses; a no-team Student | Render `/progress` | Loading, empty, error with Retry and recovery; no-team state; Late badge and labels in rows |
| TEST-11.1e | 11.1, 11.2 | E | A seeded team with a submitted milestone and an unsubmitted one | The Student opens Progress and follows a row link | The rows show the version, feedback status and "Not released"; the link opens the milestone page |
| TEST-11.3i (phase 2) | 11.3 | I | After F-10: a grade recorded, then released | GET before and after the release | As AC-11.3 |

**Commit order:**
1. contract (this PR, reviewed);
2. tests, with a RED run (the route doesn't exist yet, so it returns 404);
3. implementation, with a GREEN run;
4. full regression;
5. TEST-11.3i is added once F-10 is merged.

## 5. Definition of Done

- [ ] Contract reviewed and approved by @Earth2509 before tests and code.
- [ ] RED and GREEN recorded with commands, commits and counts. Phase 1 tests pass; AC-11.3 is reported as planned until F-10 merges.
- [ ] Server, client and Docker checks pass in CI. Local Playwright passes. Nothing skipped or weakened.
- [ ] Traceability (FR-22) and the feature inventory updated with the actual status of each AC.
- [ ] PR approved by @Earth2509 and integrated, then included in the D2 release candidate and checked on the deployed app.
