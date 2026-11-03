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

Prerequisites: **Node.js 24**, and **PostgreSQL 16** — either Docker Desktop (recommended, needed for Lab 5 anyway) or your own install.

```bash
# 1. Database (Docker: throw-away local Postgres on port 5433)
docker compose up -d db

# 2. API
cd server
cp .env.example .env          # defaults match docker-compose.yml; edit DATABASE_URL for your own Postgres
npm install                   # also runs `prisma generate`
npx prisma migrate deploy     # apply committed migrations
npm run prisma:seed           # idempotent; safe to re-run
npm run dev                   # http://localhost:3000/api/health

# 3. UI (second terminal)
cd client
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

### Tests

| Command (folder) | What it runs |
|---|---|
| `npm test` (`server/`) | Vitest + Supertest against an isolated `cpms_test` schema (reset and migrated each run; never touches `public`) |
| `npm run typecheck` (`server/`) | `tsc` over source and tests |
| `npm test` (`client/`) | Vitest + Testing Library (jsdom) |
| `npm install && npm run e2e:install && npm run e2e` (root) | Playwright: resets a separate `cpms_e2e` schema with one test Student and Supervisor, starts the API on 3101 and the UI on 4173, then drives Chromium |

### API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Liveness — `200 {"status":"ok"}`, never touches the DB |
| `GET /api/ready` | Readiness — `200 {"status":"ready","db":"connected"}`, or `503` when the DB is unreachable |
| `POST /api/auth/login` | `{email, password}` → `200 {token, user}`; `401` for a wrong password or unknown email (same message) |
| `GET /api/auth/me` | `Authorization: Bearer <token>` → `200 {user}`; `401` when missing, expired (8 h) or logged out |
| `POST /api/auth/logout` | `Authorization: Bearer <token>` → `204`; the token stops working immediately |

Errors always have the shape `{"error":{"code","message","fields?"}}`.

**Signing in locally:** accounts come from the seed (`npm run prisma:seed`, Issue #8 — F-03.1). Until
that lands, the development database has no users; the API tests and the E2E run create their own.

### Production mode (what the Lab 5 container runs)

```bash
cd client && npm run build
cd ../server && npm run build && NODE_ENV=production npm start
# one process on $PORT serves the API under /api and the built UI (SPA fallback) everywhere else
```

### Database changes

Change `server/prisma/schema.prisma`, then `npx prisma migrate dev --name <what-changed>` and commit the new folder under `prisma/migrations/`.
Migrations must be **additive** (add tables/columns; no drop/rename in the same release) so the previous image still works after a Cloud Run rollback.
