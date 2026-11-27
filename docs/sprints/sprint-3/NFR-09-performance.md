# NFR-09 Performance measurement (TEST-12.4p). Engineering Contract

**Issues:** #85 (AC-12.4), #87 · **Owner:** @Nuggetkub · **Reviewer:** @Earth2509 · **Branch:** `feature/nfr09-perf-kit`

**Requirements:** NFR-09 (SRS §5), AC-12.4 (F-12 contract v0.3), SR-03, F-03.1 (seed rules), AS-01 (one course), DEC-10.

| Version | Date | Author | Reviewer | Change |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-11-27 | @Nuggetkub | @Earth2509 | Contract and planned tests for the scaled seed and the timing script, recorded before any code. The measurement itself runs on the deployed `v1.0.0` |

## 1. What is measured

NFR-09 (SRS §5): with the demo seed scaled to **20 teams and 200 submissions**, these list endpoints must answer with **p95 < 500 ms on the deployed instance**:

| ID | Endpoint | Caller | Why this case |
| --- | --- | --- | --- |
| E1 | `GET /api/teams/:teamId/milestones` (page 1) | Perf Supervisor | A team's milestones |
| E2 | `GET /api/milestones/:milestoneId/submissions` | Perf Supervisor | A milestone's full history (the perf milestone with 5 versions) |
| E3 | `GET /api/overview` (no filters, page 1) | Perf Supervisor, assigned to **all 20 teams** | The F-12 overview. Paging limits the rows returned (50), not the milestones read (200), so this is the worst case (#113 review) |

**Method (SRS):** for each endpoint, 5 warm-up requests are discarded, then 50 sequential requests (concurrency 1) are timed. **p95 uses the nearest-rank rule:** sort the 50 times; p95 is the 48th (⌈0.95 × 50⌉). Every timed request must answer 200, or the run fails.

**Cold start** is reported separately and never counted in p95. It is the time of the run's first request, `GET /api/ready`, together with whether the service was idle beforehand (stated by the person running it). The sign-in request is not timed.

## 2. Scaled seed (opt-in)

A new step in the existing seed entry (`npm run prisma:seed`). It stays **off** unless `SEED_PERF_DATA=true`, like `SEED_DEMO_DATA` (F-03.1).

- **Input:** `SEED_PERF_DATA` (`true` / `false` / unset; any other value is an error) and `PERF_DEMO_PASSWORD` (nonblank, at most 72 UTF-8 bytes; never printed or committed). It also needs the demo seed's course `CPE334-DEMO`. If that course is missing, the step **fails without writing**: it never creates a course, because F-07 team creation needs exactly one course (AS-01, R-01).
- **Data:** everything is in the existing course, with names that can't clash with the demo data:
  - 1 Supervisor `perf.supervisor@example.test` ("Perf Supervisor"), assigned to all 20 teams. It is the only Supervisor on them.
  - 20 teams "Perf Team 01" to "Perf Team 20", each with one Student `perf.student01@example.test` … `perf.student20@example.test`.
  - 10 milestones per team ("Perf milestone 01" to "10"): 5 already due, 5 due in the future.
  - **200 submissions** (10 per team): "Perf milestone 01" has versions 1 to 5, and milestones 02 to 06 have version 1. On 3 of each team's 6 submitted milestones (01, 02, 03), the latest version has one feedback entry: **60 feedback entries**, so the overview shows Awaiting and Received.
- **Idempotent:** existing rows are found by their natural keys (email, course and team name, team and milestone title, milestone and version) and never changed. A second run writes nothing. Nothing is ever deleted.
- **Isolation:** the demo accounts are not assigned to any Perf team, so their pages don't change. The Perf Students are all assigned, so they never appear in F-07's "Available student" list.
- **Logging:** the same safe messages as the demo seed (`seedFailureMessage`), with no inputs, hashes or passwords.

## 3. Timing script

`server/scripts/perf-nfr09.ts`, run with `npm run perf:nfr09` from any machine (for example Cloud Shell).

- **Input:** `PERF_BASE_URL` (the deployed URL), `PERF_EMAIL` (default `perf.supervisor@example.test`) and `PERF_DEMO_PASSWORD`. Optional: `PERF_COLD=idle|warm|unknown`, which records whether the service was idle beforehand (default `unknown`).
- **Steps:**
  1. Time `GET /api/ready` as the cold-start sample.
  2. Read `commit` from `/api/health`.
  3. Sign in.
  4. Find E1's team ("Perf Team 01") and E2's milestone ("Perf milestone 01") through the API.
  5. Run §1 for E1, E2 and E3, in that order.
  6. Sign out.
- **Checks before timing:** E3's first page has 50 rows and `total` 200, which proves the caller sees all 20 teams. E2 has 5 versions. If either check fails, the script stops with no result.
- **Output:** a Markdown report and a JSON file. They hold the date (ICT), base URL, `commit`, cold-start sample, and for each endpoint n, min, median, p95, max, and PASS or FAIL. **Never** the password, the token or any response body. Exit code: 0 for all PASS, 1 for any FAIL, 2 for an error.
- **Revision:** the person running it adds the Cloud Run revision from the Console to the report. The script can't read it without GCP access.

## 4. Who runs what (live database)

The seed writes to the live database, so it runs **once, by @Nuggetkub**, after `v1.0.0` is deployed. It runs from Cloud Shell through the Cloud SQL Auth Proxy, in the same way as the R-01 count, with `SEED_PERF_DATA=true` and `PERF_DEMO_PASSWORD` typed in directly. No AI agent runs it. The password goes to @Earth2509 by Discord DM only. The `cpms-migrate` job and its secrets are not changed. The data stays after the measurement.

## 5. Acceptance criteria and tests

| AC | Given | When | Then |
| --- | --- | --- | --- |
| AC-P.1 | An empty test database with the demo seed | The perf step runs with the flag on; then again | 1 Supervisor on 20 teams, 20 Students, 200 milestones, 200 submissions, 60 feedback entries; the second run writes nothing; demo users see no Perf data |
| AC-P.2 | The flag unset or `false`; a bad flag value; a bad password; no `CPE334-DEMO` course | The perf step runs | Nothing written; a safe error for the bad inputs and the missing course; no course created |
| AC-P.3 | 50 known durations | The statistics are computed | min, median and max, and p95 as the 48th sorted value; PASS only when p95 < 500 ms |
| AC-P.4 | The app running locally with the perf seed | The script runs against it | A report with E1–E3, 50 timed samples each, the checks passed, the cold-start sample apart, and no password or token in the output |
| AC-12.4 | The deployed `v1.0.0` with the perf seed | @Nuggetkub runs the script | p95 < 500 ms for E1, E2 and E3; cold start reported separately; the report has the method, `commit`, revision and date |

| Test ID | AC | Level | Expected |
| --- | --- | --- | --- |
| TEST-P.1i | P.1 | I (`cpms_test`) | Exact counts; idempotent; demo Supervisors' overview and team list unchanged |
| TEST-P.2i | P.2 | I | No writes in each case; the messages match the demo seed's style; course count unchanged |
| TEST-P.3u | P.3 | U | The nearest-rank p95, including ties and unsorted input; the PASS/FAIL boundary at 499 ms and 500 ms |
| TEST-P.4i | P.4 | I (the app on a local port) | The report as in AC-P.4; the script stops when E3's total isn't 200 |
| TEST-12.4p | 12.4 | Performance (deployed) | The run as in AC-12.4, attached to #87 and recorded in the traceability matrix |

## 6. Definition of Done

- [ ] Contract approved by @Earth2509.
- [ ] RED, then GREEN; CI and review; merged into `staging/sprint-3`.
- [ ] After `v1.0.0`: the seed run and TEST-12.4p by @Nuggetkub; the report on #87; NFR-09 and AC-12.4 updated in `traceability.md`.
