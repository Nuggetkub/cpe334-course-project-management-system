# NFR-09 Performance measurement (TEST-12.4p). Engineering Contract

**Issues:** #85 (AC-12.4), #87 · **Owner:** @Nuggetkub · **Reviewer:** @Earth2509 · **Branch:** `feature/nfr09-perf-kit`

**Requirements:** NFR-09 (SRS §5), AC-12.4 (F-12 contract v0.3), SR-03, F-03.1 (seed rules), AS-01 (one course), DEC-10.

| Version | Date | Author | Reviewer | Change |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-11-27 | @Nuggetkub | @Earth2509 | Contract and planned tests for the scaled seed and the timing script, recorded before any code. The measurement itself runs on the deployed `v1.0.0` |
| 0.2 | 2026-11-28 | @Nuggetkub | @Earth2509 | #118 review: the seed checks every reserved row before writing and aborts on any conflict, all in one transaction (§2); the script checks the exact 20 Perf teams, 200 submissions and 60 feedback entries before timing (§3); TEST-P.2i and TEST-P.4i add the conflict and wrong-workload cases |
| 0.3 | 2026-11-28 | @Nuggetkub | @Earth2509 | RED details: Student names, the median rule, the report date format and the module files (§2, §3) |
| 0.4 | 2026-11-28 | @Nuggetkub | @Earth2509 | #119 review: the JSON keeps the raw times; Markdown and the console truncate to 0.1 ms, so a passing p95 never shows as 500 (§3). New AC-P.5 / TEST-P.5u: a scripted server and clock check the 499.96 ms and 500 ms cases, 5 + 50 requests per endpoint, and a non-200 while timing |

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
  - 20 teams "Perf Team 01" to "Perf Team 20", each with one Student `perf.student01@example.test` … `perf.student20@example.test` ("Perf Student 01" … "Perf Student 20").
  - 10 milestones per team ("Perf milestone 01" to "10"): 5 already due, 5 due in the future.
  - **200 submissions** (10 per team): "Perf milestone 01" has versions 1 to 5, and milestones 02 to 06 have version 1. On 3 of each team's 6 submitted milestones (01, 02, 03), the latest version has one feedback entry: **60 feedback entries**, so the overview shows Awaiting and Received.
- **Idempotent:** existing rows are found by their natural keys (email, course and team name, team and milestone title, milestone and version) and never changed. A second run writes nothing. Nothing is ever deleted.
- **Conflicts abort (#118 review):** a natural-key match alone doesn't prove a row is a Perf fixture. Before writing anything, the step reads every reserved row and checks that it matches the fixture exactly:
  - a reserved email belongs to a user with the expected role (Supervisor or Student) and name;
  - a Perf team is in `CPE334-DEMO`; its only Supervisor is the Perf Supervisor and its only Student is its own Perf Student;
  - a Perf Student is on no other team, and the Perf Supervisor supervises no team outside the Perf set;
  - a Perf team has no milestones outside "Perf milestone 01" to "10"; a matched milestone has the expected due-date side (past or future); its submissions are the expected versions by its team's Perf Student, and feedback sits only on the expected latest versions, by the Perf Supervisor.

  If any check fails, the step **aborts without writing** and prints a safe message that names the rule (for example "a reserved Perf team has another member"), never the row's data. The checks and all writes run in **one database transaction**, so a failure part-way leaves no partial data. Rows that match are kept, so a rerun on valid fixtures still writes nothing, and a run after an interrupted one only adds what is missing.
- **Isolation:** the demo accounts are not assigned to any Perf team, so their pages don't change. The Perf Students are all assigned, so they never appear in F-07's "Available student" list.
- **Logging:** the same safe messages as the demo seed (`seedFailureMessage`), with no inputs, hashes or passwords.
- **Code:** `server/prisma/perf-seed.ts` (`readPerfSeedConfig`, `seedPerf`), called by `prisma/seed.ts` after the demo step.

## 3. Timing script

`server/scripts/perf-nfr09.ts`, run with `npm run perf:nfr09` from any machine (for example Cloud Shell). It reads the environment and writes the files; the statistics and the run are in `server/scripts/perf-nfr09-lib.ts` (`summarize`, `p95NearestRank`, `verdict`, `runPerf`), so the tests call them directly.

- **Input:** `PERF_BASE_URL` (the deployed URL), `PERF_EMAIL` (default `perf.supervisor@example.test`) and `PERF_DEMO_PASSWORD`. Optional: `PERF_COLD=idle|warm|unknown`, which records whether the service was idle beforehand (default `unknown`).
- **Steps:**
  1. Time `GET /api/ready` as the cold-start sample.
  2. Read `commit` from `/api/health`.
  3. Sign in.
  4. Find E1's team ("Perf Team 01") and E2's milestone ("Perf milestone 01") through the API.
  5. Run §1 for E1, E2 and E3, in that order.
  6. Sign out.
- **Checks before timing (#118 review):** `total` 200 counts milestones, not submissions, and doesn't show which teams the caller sees. So the script checks the workload directly, with untimed requests:
  1. **Teams:** `GET /api/teams` returns exactly the 20 teams "Perf Team 01" to "Perf Team 20", with no other team.
  2. **Overview:** all 4 pages of `GET /api/overview` give 200 rows, `total` 200 on each page, 10 rows per team, and only those 20 team IDs.
  3. **Submissions:** for each milestone that has a submission, `GET /api/milestones/:id/submissions` is read; the versions add up to **200**, 10 per team, with 5 on "Perf milestone 01" and 1 on each of 02 to 06.
  4. **Feedback:** the overview shows **60** milestones with feedback received, 3 per team.
  5. **E2:** the E2 milestone has 5 versions.

  If any check fails, the script stops with exit code 2 and writes no timings and no PASS. The report records that the checks passed.
- **Output:** a Markdown report and a JSON file. They hold the date (ICT, as `YYYY-MM-DD HH:mm ICT`), base URL, `commit`, cold-start sample, and for each endpoint n, min, median (the mean of the two middle values when n is even), p95, max, and PASS or FAIL. The JSON holds the **raw** times in ms, and the verdict uses the raw p95. Markdown and the console show each time **truncated** (not rounded) to 0.1 ms, so a p95 below 500 never shows as 500.0 (for example, 499.96 shows as 499.9 PASS, and 500 as 500.0 FAIL). **Never** the password, the token or any response body. Exit code: 0 for all PASS, 1 for any FAIL, 2 for an error, including a non-200 answer to any timed or warm-up request (then no timings and no PASS).
- **Revision:** the person running it adds the Cloud Run revision from the Console to the report. The script can't read it without GCP access.

## 4. Who runs what (live database)

The seed writes to the live database, so it runs **once, by @Nuggetkub**, after `v1.0.0` is deployed. It runs from Cloud Shell through the Cloud SQL Auth Proxy, in the same way as the R-01 count, with `SEED_PERF_DATA=true` and `PERF_DEMO_PASSWORD` typed in directly. No AI agent runs it. The password goes to @Earth2509 by Discord DM only. The `cpms-migrate` job and its secrets are not changed. The data stays after the measurement.

## 5. Acceptance criteria and tests

| AC | Given | When | Then |
| --- | --- | --- | --- |
| AC-P.1 | An empty test database with the demo seed | The perf step runs with the flag on; then again | 1 Supervisor on 20 teams, 20 Students, 200 milestones, 200 submissions, 60 feedback entries; the second run writes nothing; demo users see no Perf data |
| AC-P.2 | The flag unset or `false`; a bad flag value; a bad password; no `CPE334-DEMO` course; a reserved row that doesn't match the fixture (wrong role, extra member, other Supervisor, extra milestone), alone or after part of the data exists | The perf step runs | Nothing written, or the database left exactly as before the run (no partial data); a safe error naming the rule; no course created |
| AC-P.3 | 50 known durations | The statistics are computed | min, median and max, and p95 as the 48th sorted value; PASS only when p95 < 500 ms |
| AC-P.4 | The app running locally with the perf seed | The script runs against it | A report with E1–E3, 50 timed samples each, the workload checks passed, the cold-start sample apart, and no password or token in the output. When the overview still totals 200 but the team set, the submission count or the feedback count is wrong, the script stops with exit code 2 and no PASS |
| AC-P.5 | A scripted server and clock (no network, fixed durations) | The script runs | Each endpoint gets exactly 5 warm-up and 50 timed requests after the checks; a raw p95 of 499.96 ms is PASS and shows as 499.9, exactly 500 ms is FAIL and shows as 500.0, with the raw values in the JSON; a non-200 on a timed request gives exit 2 and no PASS |
| AC-12.4 | The deployed `v1.0.0` with the perf seed | @Nuggetkub runs the script | p95 < 500 ms for E1, E2 and E3; cold start reported separately; the report has the method, `commit`, revision and date |

| Test ID | AC | Level | Expected |
| --- | --- | --- | --- |
| TEST-P.1i | P.1 | I (`cpms_test`) | Exact counts; idempotent; demo Supervisors' overview and team list unchanged |
| TEST-P.2i | P.2 | I | No writes in each case; the messages match the demo seed's style; course count unchanged. Conflict cases: each incompatible match aborts, and a conflict found after other Perf rows were checked leaves the row counts of every table unchanged (rollback) |
| TEST-P.3u | P.3 | U | The nearest-rank p95, including ties and unsorted input; the PASS/FAIL boundary at 499 ms and 500 ms |
| TEST-P.4i | P.4 | I (the app on a local port) | The report as in AC-P.4. The script stops with exit 2 and no PASS when: E3's total isn't 200; the total is 200 but one Perf team is swapped for another team; the total is 200 but one submission is missing; the feedback count is wrong; the sign-in fails |
| TEST-P.5u | P.5 | U (scripted `fetch` and clock) | The request counts per endpoint and phase; the reported value and verdict at 499.96 ms and 500 ms in the JSON, the Markdown and the console; the non-200 case |
| TEST-12.4p | 12.4 | Performance (deployed) | The run as in AC-12.4, attached to #87 and recorded in the traceability matrix |

## 6. Definition of Done

- [ ] Contract approved by @Earth2509.
- [ ] RED, then GREEN; CI and review; merged into `staging/sprint-3`.
- [ ] After `v1.0.0`: the seed run and TEST-12.4p by @Nuggetkub; the report on #87; NFR-09 and AC-12.4 updated in `traceability.md`.
