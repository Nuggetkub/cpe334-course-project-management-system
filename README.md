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

**Signing in locally (F-03.1):** set `SEED_DEMO_DATA=true` in `server/.env` and provide
`STUDENT_DEMO_PASSWORD` and `SUPERVISOR_DEMO_PASSWORD` (nonblank, at most 72 UTF-8 bytes each).
From the repository root, run `npm --prefix server run prisma:deploy-seed`.
Use `student1@example.test` or `supervisor1@example.test` with the corresponding password.
`smoke.student@example.test` is an unassigned Student for smoke login.
Seeding is off by default, and rerunning it does not rotate existing passwords.
Run only one seed process at a time against a given schema. If concurrent runs race, retry after the other run finishes.
Use only synthetic data and inject deployed passwords as secrets; never commit them.
API and E2E tests create their own fixtures in isolated schemas.

**Adding a protected endpoint (F-02):** never write permission logic in a route. Use the helpers in
`server/src/auth/authorize.ts` in this order: `requireAuth` (401) → `requireRole(...)` (403, wrong role)
→ `requireTeamAccess` or `assertTeamAccess` (404 for another team, no team or a missing record, the
same body as a nonexistent ID) → `jsonBody` (there is no global JSON parser) → body validation (400). Lists filter with `teamScope(req.user)` in the
query. In the same PR, add the endpoint to `server/tests/support/protected-endpoints.ts` (the 401 test
covers it from then on) and write its 403/404 tests with `expectForbidden` / `expectHidden` from
`server/tests/support/authz.ts`. The rules per endpoint are in `docs/sprints/sprint-1/F-02-authz.md` §1.5.

### Production mode (what the Lab 5 container runs)

```bash
cd client && npm run build
cd ../server && npm run build && NODE_ENV=production npm start
# one process on $PORT serves the API under /api and the built UI (SPA fallback) everywhere else
```

### Database changes

Change `server/prisma/schema.prisma`, then `npx prisma migrate dev --name <what-changed>` and commit the new folder under `prisma/migrations/`.
Migrations must be **additive** (add tables/columns; no drop/rename in the same release) so the previous image still works after a Cloud Run rollback.
