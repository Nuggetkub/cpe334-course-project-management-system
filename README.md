# Course Project Management System

CPE 334 Group Project — Semester 1/2026 — **Theme 6: Course Project Management System**

A course/supervision program where student teams submit milestone work and supervisors give feedback.
The product manages teams, milestones, submissions, feedback, and progress.

## Team

| Student ID | GitHub |
|---|---|
| 67070501046 | [@Nuggetkub](https://github.com/Nuggetkub) |
| 67070501069 | [@Earth2509](https://github.com/Earth2509) |

## Stack (same as Labs 1–4 / TokTickIT)

| Layer | Technology |
|---|---|
| UI | React 18 + Vite + TypeScript (`client/`) |
| API | Node.js + Express + TypeScript (`server/`) |
| Database | PostgreSQL via Prisma (migrations + seed) |
| Tests | Vitest + Supertest (unit/API), Playwright (`e2e/`) |
| Delivery | Docker + GitHub Actions + GCP (from Lab 5) |

## Repository layout

```
client/            React UI
server/            Express API + Prisma schema/migrations/seed
e2e/               Playwright end-to-end tests
docs/
  srs.md           Software Requirements Specification (FR/BR/NFR)
  features.md      Feature inventory
  traceability.md  Requirement → feature → sprint → AC → test
  system-sds.md    System-level design
  sprints/plan.md  Three-sprint plan
  sprints/sprint-N/  Feature contracts (SDS, AC, STS, DoD)
  labs/            Lab 5–7 evidence
  contributions.md Contribution table
  ai-use.md        AI-use declaration
```

## Git workflow

1. Create an **Issue** linked to the requirement/feature (`F-xx`) and its contract.
2. Branch from the current sprint staging branch: `feature/F-04-create-milestone`, `fix/D-03-...`, `docs/srs-baseline`.
3. Commit the **contract first**, then a **failing test**, then the implementation (TDD evidence).
4. Open a PR into `staging/sprint-N`. The **teammate** reviews with a specific check, question, or finding. Authors never approve their own PRs.
5. After integration/system tests pass, open a reviewed **release PR** `staging/sprint-N → main` and tag it (`v0.1.0`, `v0.2.0`, …).

| Branch | Purpose | Protection |
|---|---|---|
| `main` | Accepted releases only | PR + 1 approval |
| `staging/sprint-1` (then `-2`, `-3`) | Sprint integration | PR + 1 approval |

## Setup

_To be completed with the Sprint 1 scaffold (dependencies, `.env` from `.env.example`, migrate, seed, run, test)._
