# F-11 Student progress board. Engineering Contract

**Issue:** #84 · **Owner:** @Nuggetkub (moved from @Earth2509 to balance D2) · **Reviewer:** @Earth2509 · **Branch:** `feature/84-f11-progress-board`

**Requirements:** FR-22, BR-03, BR-04, BR-15, DEC-06, DEC-10, DEC-13, NFR-03, NFR-05, NFR-06, NFR-09, NFR-10.

**Depends on:** F-04 (milestones), F-06 (feedback), F-08 (window), F-09 (versions and Late), F-10 (grades and release).

**Baseline:** SRS v0.3; F-08 contract v0.4; F-09 contract v0.3; F-10 contract (pending, #83).

| Version | Date | Author | Reviewer | Change |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-11-25 | @Nuggetkub | @Earth2509 | Contract and planned tests, before any F-11 test or code |
| 0.2 | 2026-11-25 | @Nuggetkub | @Earth2509 | PR #93 review of `598c92b`: phase 1 and phase 2 tests separated (TEST-11.2u is feedback only; new TEST-11.3u for grades). AC-11.3 stays planned until F-11 is wired to F-10 and the before/after-release check passes; a merged F-10 alone doesn't complete it. §6 records the release path into `v0.6.0` and the DEC-11 deviation (DEC-15) |
| 0.3 | 2026-11-25 | @Nuggetkub | @Earth2509 | PR #93 re-review of `4f0138f`: F-10 ships in `v0.5.0` before the phase 1 board, so a phase 1 "Not released" could be false. Phase 1 now **omits `grade` from every row and has no Grade column**; `{released: false}` and "Not released" are used only for the real F-10 state in phase 2. TEST-11.1i, TEST-11.6c and TEST-11.1e assert the omission |

## 1. Feature design

A Student opens **Progress** and sees one row per milestone of their team. The row shows:
- the window and the team status, computed by the existing F-08/F-09 status functions;
- the **latest version** (number, time, and whether it's Late);
- the **feedback status** of that latest version;
- from phase 2 only: the **released grade**, or "Not released".

The board only reads data, and it never shows anything another page couldn't show the same user.

**Grade column and F-10.** The released grade comes from F-10 (#83).
- **Phase 1 (D2 target):** this contract can be implemented and tested on everything except the grade (AC-11.1, 11.2, 11.4–11.6). Rows have **no `grade` key** and the UI has **no Grade column**. F-10 is released in `v0.5.0` before this board ships (§6), so a placeholder "Not released" could be false for a grade that is already released. Phase 1 therefore shows nothing about grades at all.
- **Phase 2:** after F-10 is merged, F-11 is wired to F-10's release state. Only then is `grade` added to each row and the Grade column shown, with `{released: false}` / "Not released" meaning F-10's real unreleased state. TEST-11.3u and TEST-11.3i are added then, test-first.

AC-11.3 stays **planned** until that wiring is done and the before/after-release behaviour is verified, including that the response has no `score` key before release. A merged F-10 on its own doesn't complete AC-11.3. D2 reports it as planned unless all of this is done before the D2 candidate.

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
| `grade` (phase 2 only; absent in phase 1) | `{released: true, score}` only when F-10 says the milestone's grades are released for this team (BR-15, DEC-06). Otherwise `{released: false}`, with **no score field at all**, so an unreleased value can't leak through the API |

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

Each row is `{milestoneId, title, dueAt, window, teamStatus, latest, feedbackStatus}` in phase 1; phase 2 adds `grade`. An empty team is 200 with `rows: []`.

- **Errors:** 401, 404 (fixed body), 400 `VALIDATION_ERROR` on `fields.page` (only after the ownership check).
- **Query shape:** one query for the page of milestones, with the latest submission (`take: 1` by version desc) and a feedback count for that version, plus one count. No per-row queries. NFR-09's method covers it in Sprint 3.

### Data

No migration. Reads only.

### UI

A new route `/progress` and a **Progress** navigation link for Students.
- **Table:** Milestone (links to `/milestones/:id`) | Due (ICT) | Window | Team status | Latest version | Feedback, plus Grade from phase 2.
  - "Latest version" shows "Version N" plus a **Late** badge, or "Not submitted".
  - Feedback shows "Feedback received", "Awaiting feedback" or "—".
  - Grade (phase 2 only) shows the score or "Not released". Phase 1 has no Grade column and no grade text.
- **States:** loading "Loading progress…"; empty "No milestones yet"; error "Could not load progress." with **Retry**; no-team empty state; Previous/Next pages.
- On narrow screens, the table turns into stacked rows with the same labels.

## 3. Acceptance criteria

| AC | Given | When | Then | Covers |
| --- | --- | --- | --- | --- |
| AC-11.1 | A Student of team A. Milestones: no submission and due in the future; no submission and overdue; submitted on time; latest version Late; closed by a Supervisor | They open Progress | One row per milestone of team A only, ordered by due date, with the same window and team status as the milestone page | FR-22, DEC-13 |
| AC-11.2 | A milestone with versions 1 and 2, and feedback only on version 1 | They read the row | Latest is version 2 with its Late flag, and feedback status is `AWAITING`. After feedback is added to version 2 it becomes `RECEIVED` | FR-22, BR-10 |
| AC-11.3 (phase 2: after F-11 is wired to F-10) | A grade recorded but not released, then released | They read the row before and after release | Before: `{released: false}`, with no score in the JSON. After: `{released: true, score}` | FR-22, BR-15, DEC-06 |
| AC-11.4 | An anonymous user, a Student of team B, a Student with no team, an unassigned Supervisor, a malformed or missing team ID | They GET team A's progress | 401, then the fixed 404 for hidden or missing scope. No other team's data appears | BR-03, BR-04, NFR-03 |
| AC-11.5 | Team A has 51 milestones, some with tied due dates | They request pages 1 and 2, and an invalid page | 50 + 1 rows in dueAt/id order with `total` 51. An invalid page → 400 after the ownership check | NFR-09, NFR-10 |
| AC-11.6 | The board is loading, empty, failed or the Student has no team | They open Progress | Loading, empty, error with Retry, and no-team states are shown; Retry recovers | NFR-10 |

## 4. Software Test Specification

Levels as in F-08: **U** (Vitest), **I** (Supertest against PostgreSQL `cpms_test` with a fixed clock), **C** (React with mocked fetch), **E** (Chromium against `cpms_e2e`).

| Test ID | AC | Level | Preconditions / inputs | Steps | Expected |
| --- | --- | --- | --- | --- | --- |
| TEST-11.2u | 11.2 | U | Latest null; latest with 0 or 1+ feedback; feedback only on an older version | Call `progressRow(...)` | `feedbackStatus` exactly as in §1 (`NONE`, `AWAITING`, `RECEIVED`; older-version feedback gives `AWAITING`) |
| TEST-11.1i | 11.1 | I | Team A with the five milestone states from AC-11.1, team B with one milestone, fixed clock | GET A's progress as sA; GET the F-04 list as sA | Only A's rows, in order. `window` and `teamStatus` equal the F-04 list values row by row. Phase 1: no row has a `grade` key |
| TEST-11.2i | 11.2 | I | Versions 1 and 2, feedback on version 1 | GET; then add feedback to version 2 and GET again | Latest is version 2; `AWAITING`, then `RECEIVED` |
| TEST-11.4i | 11.4 | I | Anonymous, sB, s0, pB, malformed or missing ID | GET A's progress | 401, then the fixed 404 ×4. Response bodies contain no team A titles |
| TEST-11.5i | 11.5 | I | 51 milestones in A with tied due dates | GET page 1, page 2, page 0, page `abc` | 50 + 1 rows, stable order, total 51; 400 for an invalid page |
| TEST-11.6c | 11.6 | C | Mocked deferred, empty, failing-then-recovering responses; a no-team Student | Render `/progress` | Loading, empty, error with Retry and recovery; no-team state; Late badge and labels in rows; phase 1: no Grade column header and no "Not released" text |
| TEST-11.1e | 11.1, 11.2 | E | A seeded team with a submitted milestone and an unsubmitted one | The Student opens Progress and follows a row link | The rows show the version and feedback status, with no Grade column; the link opens the milestone page |
| TEST-11.3u (phase 2) | 11.3 | U | F-10 grade unreleased; released with a score | Call `progressRow(...)` | `{released: false}` with no `score` key; then `{released: true, score}`. The Grade column appears with this change |
| TEST-11.3i (phase 2) | 11.3 | I | After F-10 and the F-11 wiring: a grade recorded, then released | GET before and after the release | Before: no `score` key anywhere in the JSON. After: `{released: true, score}` |

**Commit order:**
1. contract (this PR, reviewed);
2. tests, with a RED run (the route doesn't exist yet, so it returns 404);
3. implementation, with a GREEN run;
4. full regression;
5. phase 2, after F-10 is merged: TEST-11.3u and TEST-11.3i with a RED run, then the F-10 wiring with a GREEN run. Only then is AC-11.3 reported as done.

## 5. Definition of Done

- [ ] Contract reviewed and approved by @Earth2509 before tests and code.
- [ ] RED and GREEN recorded with commands, commits and counts. Phase 1 tests pass; AC-11.3 is reported as planned until the phase 2 wiring and TEST-11.3u/11.3i pass.
- [ ] Server, client and Docker checks pass in CI. Local Playwright passes. Nothing skipped or weakened.
- [ ] Traceability (FR-22) and the feature inventory updated with the actual status of each AC.
- [ ] PR approved by @Earth2509 and integrated, then included in the D2 release candidate and checked on the deployed app.

## 6. Release path

| Step | Branch / PR | Result |
| --- | --- | --- |
| 1 | Sprint 2 release PR `staging/sprint-2` → `main` (#87), after F-07, F-08, F-09 and F-10 are integrated and accepted | Tag `v0.5.0`, deployed and checked |
| 2 | Sync PR `main` → `staging/sprint-2` through a temporary branch, as after every release (DEC-11) | Staging equals `v0.5.0` |
| 3 | F-11 phase 1 PR `feature/84-f11-progress-board` → `staging/sprint-2`, reviewed by @Earth2509 | F-11 integrated on staging |
| 4 | Second release PR `staging/sprint-2` → `main`, with regression and UAT on staging first | Tag `v0.6.0`, the D2 release candidate, deployed and checked |

**Deviation from DEC-11.** DEC-11 keeps one staging branch per sprint, so F-11 (Sprint 3) would go through `staging/sprint-3`. For D2, F-11 phase 1 goes through `staging/sprint-2` instead (steps 3–4), so the candidate needs no second staging branch, ruleset target or sync path in the last 4 days. This is recorded as **DEC-15** in `docs/decisions.md`. After `v0.6.0`, `staging/sprint-3` is created from `main`; F-11 phase 2, F-12 and F-13 go there for Final Delivery, which restores DEC-11.

F-12 isn't part of `v0.6.0`: it stays contract-only for D2.
