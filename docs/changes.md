# Change and defect register

**Issue:** #87 (D2) · **Baseline:** [SRS v0.4](srs.md) · **Matrix:** [traceability.md](traceability.md) · **Status date:** 2026-11-25 (staging `4f56155`)

| Version | Date | Author | Reviewer | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-25 | @Nuggetkub | @Earth2509 | First register for D2 Part A: releases, UAT and Lab 7 findings, defects found in Sprint 2/3 reviews, and approved baseline revisions |
| 0.2 | 2026-11-25 | @Nuggetkub | @Earth2509 | PR #99 review: D-10 resolved for F-08/F-09 by #100; new D-11 (flaky sign-in wait), D-12 and D-13 (PR #101 review); grade release revision |

This register records every finding that changed the product, its tests or its baseline since the accepted Sprint 1 release. Earlier records keep their own detail ([Lab 6 findings](labs/lab06/findings.md), the Lab 7 report, PR reviews); this page is the one index with current status.

**Status values:**
- **Resolved, released**: the fix is on `main` and checked on the deployed app.
- **Resolved, integrated**: the fix is reviewed and merged into `staging/sprint-2`, waiting for the next release.
- **Resolved in PR**: fixed and green on its PR, not yet integrated.
- **Open**: not fixed yet. The remaining-work plan ([plan.md](sprints/plan.md#remaining-work-to-13-december)) gives the owner and date.

## 1. Releases

| Release | Commit | Deployed revision | Scope | Acceptance |
|---|---|---|---|---|
| `v0.3.0` (**accepted Sprint 1**) | `b6cffa1` | `cpms-00007-7r8` | F-01 to F-06 | StudyTrack UAT: **Accepted for the tested scope**, 22 Nov 2026 ([#70 comment](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/70#issuecomment-7079679438)) |
| `v0.4.0` (Lab 7) | `aa191ba` | `cpms-00008-l48` | `v0.3.0` + CR-01 + Lab 6 docs/tests | Deployed checks L7-D00 to D04 PASS (24 Nov) |
| `v0.5.0` (Sprint 2, **planned**) | — | — | F-07 to F-10 | Not released yet. F-07 to F-09 and the F-10 server are integrated (`4f56155`); waits on the F-10 Grade UI (AC-10.5), which is on PR #101. Single-course preflight passed (R-01) |
| `v0.6.0` (D2 candidate, **planned**) | — | — | `v0.5.0` + F-11 phase 1 (#94) | Not released yet (F-11 §6, DEC-15) |

## 2. Findings and defects

| ID | Source | Found | Affected requirement / feature | Decision | Status | Fix / change | Re-test outcome |
|---|---|---|---|---|---|---|---|
| UAT-S1 | Lab 6 UAT by StudyTrack (two runs) | 18–20 Nov | F-01 to F-06 | No findings: 6/6 cases PASS twice, 33/33 required steps | Closed: no defect | — | Accepted for the tested scope (22 Nov) |
| UAT-70 | Lab 6 Part D controlled exercise ([#70](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/70)) | 21 Nov | AC-06.2, BR-10 (F-06) | Accepted defect, Minor. Planted in the isolated exercise build only (#69); never on `main` | Resolved (exercise service) | [#71](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/71) `406016f`. The regression test TEST-06.2d is on `main` from `v0.4.0` | Independent retest by Datakung PASS (22 Nov 17:56) |
| CR-01 | Lab 7 change request ([#73](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/73)) | 24 Nov | BR-05, AC-04.2 (F-04) | Approved change: due date at least 24 h after server time on create | Resolved, released `v0.4.0` | #74 contract, #75 tests then code (RED `d8a692a`, GREEN `8d0528c`) | L7-D01 to D04 PASS on `cpms-00008-l48` |
| D-01 | PR #90 review (F-08) | 24 Nov | AC-08.2, AC-08.3, AC-08.6 (F-08 races) | Defect in the **tests**: the concurrency tests also passed on the unlocked code (the helper returned the commit promise; connection set-up was slower than the hold) | Resolved, integrated | F-08 v0.4: `holdLock` returns `{committed}`, pool warm-up, 1500 ms hold; row lock `SELECT … FOR UPDATE` | RED `340731a` then GREEN `d3aaf76`; CI on #90 |
| D-02 | F-09 implementation | 24 Nov | BR-07 → BR-08 (F-05, F-08, F-09) | Three older tests still asserted BR-07 (TEST-05.6, TEST-05.1e, TEST-08.9i). Revised as named test changes, each committed before the implementation | Resolved, integrated | `6431417`, `f4e15fd`, `6006b5d`; F-09 contract v0.3 | RED `6006b5d` (13 failed), GREEN `77a2cf7` |
| D-03 | PR #92 review (F-09) | 25 Nov | AC-09.6, BR-08 | Defect: the version retry treated **any** Prisma `P2002` as a version collision | Resolved, integrated | F-09 v0.4: retry only when `meta.target` is `(milestone_id, version)` (`a62ef82`) | RED `3a54a00` (1 failed), GREEN `e8b8e2c` (249/249) |
| D-04 | PR #95 review (F-07) | 25 Nov | AC-07.4, BR-16 | Defect in the **tests**: TEST-07.4bi passed 3/3 runs with the membership lock removed | Resolved, integrated | `7fecac1`: held-lock tests that check `pg_blocking_pids` | Both new cases fail without `FOR UPDATE` and pass with it, 2/2 runs each (Earth2509 and Nuggetkub) |
| D-05 | F-11 CI RED run | 25 Nov | NFR-11 (test isolation), F-11 | Defect in the **tests**: the new progress suite left rows behind, and `auth.test.ts` failed 16 tests when CI ran it next | Resolved in PR #94 | `d37107b`: `afterAll` cleanup, as in the other database suites. No old test changed | CI RED `45569662249` failed in the F-11 files only |
| D-06 | PR #94 review (F-11) | 25 Nov | AC-11.4, BR-03, DEC-10 | Defect: the team lookup inside the snapshot wasn't scoped, so access lost after the guard could return the team name | Resolved in PR #94 | `e69c9e6` (TEST-11.4bi) | RED `b9fd690`, GREEN CI `45576686309` |
| D-07 | PR #94 review (F-11) | 25 Nov | AC-11.6, NFR-10 | Defect: a 120-character unbroken title widened the page (1,440 px at 390 px; 1,722 px at 768 px, found while fixing) | Resolved in PR #94 | `e69c9e6` (TEST-11.6e) | Local E2E RED 2 failed, GREEN 12/12; re-checked by Earth2509 at 320/390/768 px |
| D-08 | PR #94 re-review (F-11) | 25 Nov | AC-11.4, NFR-03 | Defect: an invalid page after lost access returned 400 instead of the fixed 404 | Resolved in PR #94 | `3b72786` | RED `0410f25` (1 failed), GREEN CI `45586183430` |
| D-09 | D2 document audit | 25 Nov | NFR-12 | Gap: SRS v0.3 planned a **CI secret scan** for Sprint 2. No workflow has one; only `.env` ignoring and review apply | **Open** | Add a secret-scanning step to `ci.yml` | Planned: a seeded fake secret must fail the check |
| D-10 | D2 document audit | 25 Nov | NFR-02, AC-02.1 (F-02 registry rule) | Process defect: F-08 (`PATCH /api/milestones/:id`, `POST …/close`), F-09 (`GET …/submissions`) and F-11 (`GET /api/teams/:teamId/progress`) didn't add their routes to `server/tests/support/protected-endpoints.ts`, so TEST-02.1 didn't sweep them. Each route's 401 was still tested by its own feature test | **Resolved, integrated** for F-08/F-09 ([#100](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/100), `19a9b1d`). **Open** for F-11: its entry goes into #94 | `2d9d900`: 14 new TEST-02.1 cases | CI 45613251584 (server 329); mutation: without `requireAuth` on the history route its 4 cases fail |
| D-11 | F-10 UI regression run | 25 Nov | NFR-11 (test reliability), F-05 | Test defect: TEST-05.1e's sign-in step waits only 5 s for "Log out". In one full local run it timed out; alone it passed 2/2 and the full rerun passed 12/12. The cause of the slow sign-in is not yet known | **Open** | Wait for the post-login navigation (or the `/api/auth/me` response) with the default test timeout, in every spec's `signIn` helper | Planned: 3 consecutive clean full runs |
| D-12 | PR #101 review (F-10) | 25 Nov | AC-10.3, AC-10.5, BR-15 | Defect: a release confirmed for draft 70 published another Supervisor's newer draft 82 (the release had no body) | Resolved in PR #101 | F-10 v0.5: `{expectedScore}` compared under the milestone lock, 409 `GRADE_DRAFT_CHANGED` (`c4c86c2`) | RED `582ff7a` (CI 45632905007), GREEN CI 45633427363; E2E two-session journey |
| D-13 | PR #101 review (F-10) | 25 Nov | AC-10.5, NFR-10 | Defect: a malformed `200` grade body (no `releasedAt`) crashed the milestone page | Resolved in PR #101 | Strict role-specific response checks on read, save and release (`c4c86c2`) | 7 new TEST-10.5c cases; RED 9 failed, GREEN 83/83 |
| R-01 | F-07 design (#95) | 25 Nov | FR-07, AS-01 | Risk: team creation needs exactly one course row | **Resolved** (gate passed) | Read-only `SELECT COUNT(*) FROM courses;` on the live `cpms` database (Cloud SQL `cpms-pg`, via Cloud SQL Auth Proxy in Cloud Shell), run by @Nuggetkub on 25 Nov | **1 course**: F-07 team creation will work after `v0.5.0`. No data changed |

## 3. Approved baseline revisions

| Date | Revision | Rationale | Approved in | Effect |
|---|---|---|---|---|
| 2026-11-24 | **CR-01**: BR-05 due date at least 24 h ahead on create (and on extend, F-08) | Lab 7 change request | #73, #74 | SRS v0.3; AC-04.2; F-08 AC-08.2 uses the same minimum |
| 2026-11-24 | **BR-07 retired; BR-08 active** (versioned resubmission) | Planned since D1 (DEC-04) | F-09 contract v0.2 (#89), implementation #92 | TEST-05.4a/b retired; TEST-05.1, 05.6, 05.7, 05.1e and 08.9i revised (D-02) |
| 2026-11-24 | **Milestone deletion has no endpoint** (BR-14 holds because nothing can delete) | Simplest way to keep submissions | F-08 contract (#88) | `DELETE` returns 404; AC-08.7 |
| 2026-11-25 | **Single-course team creation** (409 `COURSE_UNAVAILABLE` unless exactly one course) | One offering per deployment (AS-01, EX-06) | F-07 contract (#91) | R-01 release gate |
| 2026-11-25 | **Grades: draft and released snapshot**. A new draft stays private after a release until it is released again; grading is allowed with no submission and in any window | Students must never see an unreleased value (BR-15) | F-10 contract v0.2 (#96) | SRS BR-15 wording; F-11 phase 2 and F-13 use `studentGrade(row)` |
| 2026-11-25 | **A grade release names the confirmed draft** (`expectedScore`); a changed draft gives 409 `GRADE_DRAFT_CHANGED` | A stale confirmation must never publish another Supervisor's draft (D-12) | F-10 contract v0.5, PR #101 | AC-10.3, AC-10.5; TEST-10.3di |
| 2026-11-25 | **F-11 in two phases**: phase 1 omits the grade completely; AC-11.3 waits for F-10 | F-10 ships before the board, so a placeholder "Not released" could be false | F-11 contract v0.3 (#93) | AC-11.3 planned |
| 2026-11-25 | **DEC-15**: F-11 phase 1 goes through `staging/sprint-2` into `v0.6.0`; `staging/sprint-3` starts after `v0.6.0` | No second staging path in the last days before D2 | #93 | Deviation from DEC-11, recorded |
| 2026-11-25 | **F-12**: filtering by an unsupervised team returns the fixed 404 | Don't confirm other teams exist (DEC-10) | F-12 contract (#93) | AC-12.3 |
| 2026-11-25 | **F-13**: export published grades only; over 10,000 rows → 400 with `fields.filters` | Shareable report; no silent truncation | F-13 contract v0.2 (#97) | AC-13.2, AC-13.3 |
