# F-12 Supervisor overview and filters. Engineering Contract

**Issue:** #85 · **Owner:** @Nuggetkub · **Reviewer:** @Earth2509 · **Branch:** `feature/85-f12-overview`

**Requirements:** FR-23, FR-24, BR-02, DEC-05, DEC-10, DEC-13, NFR-03, NFR-05, NFR-09, NFR-10.

**Depends on:** F-06, F-08 and F-09 (grades are not shown here, so F-10 isn't needed). **Used by:** F-13 (CSV export reuses this scope and these filters).

**Baseline:** SRS v0.3; F-11 contract v0.1.

| Version | Date | Author | Reviewer | Change |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-11-25 | @Nuggetkub | @Earth2509 | Contract and planned tests. **D2 target: contract only**; implementation is planned for Final Delivery (13 Dec) |

## 1. Feature design

A Supervisor opens **Overview** and sees one row per milestone across all the teams they supervise. Each row is labelled with one submission state and one feedback state, so they can see what needs attention. They can filter by team and by state.

### Row states (one server instant per response)

| `submissionState` | Condition (first match wins) |
| --- | --- |
| `LATE` | The latest version is Late (F-09) |
| `SUBMITTED` | The latest version is on time |
| `MISSING` | No submission, and the deadline has passed (team status Overdue) |
| `NOT_DUE` | No submission, and the deadline hasn't passed yet |

| `feedbackState` | Condition |
| --- | --- |
| `AWAITING` | A latest version exists and has no feedback ("awaiting feedback", FR-23) |
| `RECEIVED` | The latest version has at least one feedback entry |
| `NONE` | There's no submission |

`window` is also returned, so a Late-window or Closed milestone can be seen. The states reuse the F-09 `teamStatus` mapping, so the board (F-11), the milestone page and this overview always agree.

### Workflow and authorization

`GET /api/overview?team=ID&state=S&page=N` runs requireAuth (401) → requireRole(SUPERVISOR) (403) → filter validation (400) → one query scoped to the caller's supervised teams (BR-02) → 200.

- **`team`:** optional. It must be one of the caller's supervised teams. An unsupervised or unknown team returns **404 with the fixed body** (DEC-10), not an empty list, so another team's existence isn't confirmed.
- **`state`:** optional and repeatable: `LATE`, `SUBMITTED`, `MISSING`, `NOT_DUE` or `AWAITING`. `AWAITING` filters on `feedbackState`, and the others filter on `submissionState`. Repeated values are combined with OR. Any other value → 400 `fields.state`.
- **`page`:** a positive integer, default 1, 50 rows per page.
- **Order:** team name, then `dueAt`, then milestone `id`.

| Caller | Result |
| --- | --- |
| Anonymous | 401 |
| Student | 403 |
| Supervisor with no teams | 200, empty |
| Supervisor | Only their teams' rows |

### Dependencies and scope
- **No schema change:** it only reads data.
- **Performance (NFR-09):** one scoped query plus one count. With the demo seed scaled to 20 teams and 200 submissions, p95 must be < 500 ms on the deployed instance, measured with the SRS method (5 warm-up requests discarded, then 50 sequential requests).
- **Out of scope:** writes; CSV (F-13); grades in the overview (F-10 covers grade entry; the overview shows only states).

## 2. Layer specifications

**API:** `GET /api/overview` returns 200 `{rows, page, pageSize: 50, total, filters: {team, state}}`. Each row is `{teamId, teamName, milestoneId, title, dueAt, window, submissionState, feedbackState, latestVersion}`.

**Data:** no migration. Reads only.

**UI:** a new route `/overview` and an **Overview** navigation link for Supervisors.
- **Filters:** a Team select ("All my teams" plus each team) and state checkboxes. Filters are kept in the URL query, so a filtered view can be reloaded or shared.
- **Table:** Team | Milestone (links to `/milestones/:id`) | Due (ICT) | Window | Submission | Feedback.
- **States:** loading, empty ("Nothing matches these filters" / "No milestones yet"), error with Retry, and pagination.
- **Stale responses:** a response for an older filter set must never replace the current one.

## 3. Acceptance criteria

| AC | Given | When | Then | Covers |
| --- | --- | --- | --- | --- |
| AC-12.1 | pA supervises A and A2 (but not B). Milestones cover all 4 submission states, plus Awaiting and Received | pA opens Overview | Rows for A and A2 only, in order. Each state matches the milestone page's team status and the F-11 board | FR-23, BR-02, DEC-13 |
| AC-12.2 | The same data | pA filters by team A2; by `MISSING`; by `LATE` + `AWAITING`; and by team A plus `SUBMITTED` | Exactly the matching rows. Counts and totals match the filter | FR-24 |
| AC-12.3 | A Student, an anonymous user, pA filtering by team B, an unknown state, a bad page | They GET the overview | 403; 401; fixed 404; 400 `fields.state`; 400 `fields.page`. No B data appears anywhere | BR-02, NFR-03, NFR-05 |
| AC-12.4 | The seed scaled to 20 teams and 200 submissions on Cloud Run | The NFR-09 script runs | p95 < 500 ms for the first page (cold start reported separately) | NFR-09 |
| AC-12.5 | Loading, empty, error, or a fast filter change | The Supervisor uses the page | The correct states are shown; an old response never replaces the newer filter's rows; the URL keeps the filters | NFR-10 |

## 4. Software Test Specification (planned; implementation after D2)

| Test ID | AC | Level | Inputs | Expected |
| --- | --- | --- | --- | --- |
| TEST-12.1u | 12.1 | U | Latest version on time, Late or none; feedback count; clock before and after due | The state functions return exactly the §1 tables |
| TEST-12.1i | 12.1 | I | Fixture with A, A2 and B; all states | Scoped rows, order, states equal to F-04/F-11 values |
| TEST-12.2i | 12.2 | I | Each filter combination | Matching rows and totals |
| TEST-12.3i | 12.3 | I | Unauthorized or invalid callers and filters | 401, 403, 404, 400 bodies; no B data |
| TEST-12.4p | 12.4 | Performance script | Scaled seed on Cloud Run | p95 report with method, revision and date |
| TEST-12.5c | 12.5 | C | Deferred or failing fetch; fast filter switch | States shown; no stale replacement; URL sync |
| TEST-12.1e | 12.1, 12.2 | E | Seeded Supervisor with two teams | Filter to Missing, open a row, go back with the filter kept |

## 5. Definition of Done

- [ ] Contract approved by @Earth2509 (D2: contract only, status "planned").
- [ ] Not part of the D2 candidate `v0.6.0`. Final Delivery: integrated through `staging/sprint-3` (DEC-15), with test-first implementation, RED/GREEN, regression, NFR-09 measurement, review, release and deployed check.
- [ ] F-13 reuses this scope and these filters, and is verified by CSV/filter parity.
