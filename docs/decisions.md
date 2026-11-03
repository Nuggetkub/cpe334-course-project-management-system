# Decisions Log

Resolved ambiguities from the Theme 6 stakeholder brief. Each decision is referenced from the SRS.
Status: **Proposed** until both students agree (and the instructor/TA where needed), then **Accepted**.

| ID | Question | Decision | Status | Date |
|---|---|---|---|---|
| DEC-01 | Stack | Same as Labs 1–4: React + Vite + TS, Express + TS, PostgreSQL + Prisma, Vitest/Supertest, Playwright | Proposed | 2026-11-03 |
| DEC-02 | Team membership | A student belongs to **at most one** team per course and may be unassigned (e.g. seeded before placement, or removed under FR-07). An unassigned student sees "You are not assigned to a team yet"; team-scoped API requests return 404. Membership is seeded in Sprint 1 and managed in UI from Sprint 2 | Accepted (review on PR #14) | 2026-11-03 |
| DEC-03 | Deadline rule (Sprint 1) | Server rejects a submission when server time is after the milestone `due_at` | Proposed | 2026-11-03 |
| DEC-04 | Revision policy | Sprint 1: one submission per team per milestone. Sprint 2: resubmission before the deadline creates version N+1; earlier versions are kept | Proposed | 2026-11-03 |
| DEC-05 | Supervision scope | A supervisor sees and acts only on teams in the supervisor–team assignment table | Proposed | 2026-11-03 |
| DEC-06 | Feedback / grade visibility | Members of a team see feedback on their own team's submissions; grades hidden until the supervisor releases them (Sprint 2) | Proposed | 2026-11-03 |
| DEC-07 | Roles | Student and Supervisor (one role per account) in Sprint 1 | Proposed | 2026-11-03 |
| DEC-08 | Repository visibility | Public, so branch protection and grader/UAT-partner access work | Accepted | 2026-11-03 |
| DEC-09 | Who manages teams | Supervisors create teams (auto-assigned to themselves) and manage membership of their supervised teams; no separate admin role | Proposed | 2026-11-03 |
| DEC-10 | Response to cross-team access | Return 404 (not 403) for another team's records so their existence is not confirmed; wrong-role operations return 403 | Proposed | 2026-11-03 |
| DEC-11 | Staging branches | Keep one staging branch per sprint (`staging/sprint-1`, `-2`, `-3`) instead of the Student Guide's single `staging`. CI runs on PRs into `[main, 'staging/**']`; the Lab 5 ruleset targets `main` and pattern `staging/**`; the sprint staging branch is synced with `main` (via PR) after each release | Accepted | 2026-11-03 |
| DEC-12 | Cloud-ready Sprint 1 | Build Student Guide Ep. 2 requirements into Sprint 1: DB-stored sessions, `PORT` from env, `/api/health` + `/api/ready`, env-sourced idempotent seed, auth endpoints `/api/auth/login`, `/api/auth/me`, `/api/auth/logout` (match the Lab 5 kit smoke test) | Accepted | 2026-11-03 |
| DEC-13 | Milestone status | Show two values: the **window** (Open until `due_at` inclusive → Late window in S2 → Closed; a manual close wins) and the **team status** (Late if latest version is Late → Submitted → Not submitted while now ≤ `due_at` → Overdue). Team status depends on submissions and the deadline only, so a manual close never changes it; Submitted stays Submitted after the deadline. Tables in SRS §4.3.1 | Accepted (review on PR #14) | 2026-11-03 |
| DEC-14 | Late-window scope | The late window accepts both a team's first submission and a new version; every version created in it is marked Late | Accepted (review on PR #14) | 2026-11-03 |

## Open questions for instructor/TA

- Final demo video length: master spec says ≤ 10 min / 8 pts, final-delivery handout says ≤ 4 min / 10 pts. Planning for 4 minutes until confirmed.
