# Lab 5 — Deployment

## Stack and deployment boundary

The application uses a React/Vite frontend, a Node.js/Express API, and PostgreSQL
through Prisma. The intended deployment is a single Cloud Run service serving the
built frontend and API on the same origin, with Cloud SQL for PostgreSQL and
Secret Manager for database credentials. This document covers the cloud-readiness
audit for issue #16; it does not record a live deployment.

The container holds the application and built static assets, not mutable application
data. Sessions and application records live in PostgreSQL. Submissions store links,
not uploaded files. Apply committed migrations against the target database before
serving traffic; do not run development migrations or test-schema resets there.

## Environment variables

| Variable | Purpose | Secret? | Source |
| --- | --- | --- | --- |
| `DATABASE_URL` | Prisma connection for the API, migrations and optional seed | Yes | Secret Manager for deployment; ignored `server/.env` locally |
| `PORT` | API listen port, defaults to 3000 locally | No | Cloud Run injects it |
| `HOST` | Listen address; default `0.0.0.0` | No | Leave unset on Cloud Run |
| `NODE_ENV` | Set to `production` to serve built frontend assets | No | Deployment environment |
| `CLIENT_ORIGINS` | Comma-separated origins allowed for cross-origin API calls | No | Deployment configuration if needed; local default is Vite |
| `CLIENT_DIST_DIR` | Override the built frontend directory | No | Optional runtime setting; otherwise use the image's default layout |
| `BCRYPT_COST` | Password hashing work factor; default 12, minimum 10 | No | Optional runtime setting |
| `VITE_API_URL` | Frontend API base URL, embedded at build time | No | Local client configuration; leave empty or unset for a same-origin production build |
| `SEED_DEMO_DATA` | Explicit opt-in for demo seed; unset or false disables it | No | Seed job or local environment, not normal service startup |
| `STUDENT_DEMO_PASSWORD`, `SUPERVISOR_DEMO_PASSWORD` | Passwords for demo accounts created by the seed | Yes | Inject into the authorized seed process only; do not commit |
| `TEST_DATABASE_URL` | Optional disposable integration-test database override | Yes | Local/CI test environment only |
| `E2E_DATABASE_URL` | Optional disposable Playwright database override | Yes | Environment of the root Playwright command only |
| `E2E_PASSWORD` | Password for temporary E2E fixtures | Test fixture only | Injected by Playwright into its child process; never deploy it |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Local Compose database initialization overrides | Password only | Local Compose environment; not Cloud Run application settings |

Server and client templates are in [server/.env.example](../../../server/.env.example)
and [client/.env.example](../../../client/.env.example). Any `VITE_*` value is
public in the browser bundle. Keep production values out of tracked files and logs.

## Issue #16 readiness audit

| Check | Status | Evidence |
| --- | --- | --- |
| No uploads on local disk | Already OK | Submission validation and schema accept a link; no upload path is required. |
| Demo seed uses injected passwords and is repeatable | Already OK | Seed is opt-in, hashes passwords and upserts records; re-running does not rotate existing accounts' passwords. |
| No dev shortcuts on sign-in | Already OK | Sign-in uses entered credentials; no default password or account selector is provided. |
| Sessions stored in PostgreSQL | Already OK | Sign-in persists a hashed token, requests resolve it from Prisma, and logout deletes the session. |
| Runtime port and container bind address | Already OK | Express reads `PORT` and defaults `HOST` to `0.0.0.0`. |
| Readiness returns 503 when database is unavailable | Already OK | `GET /api/ready` runs a DB query and returns 503 on failure. Verified locally over HTTP with a deliberately unreachable PostgreSQL endpoint; `GET /api/health` still returned 200. |
| Environment reference | Changed | Documented runtime, build, seed and test settings, and added E2E template entries. |

For the eventual deployment smoke check, verify `GET /api/health` returns 200
independently of the database, `GET /api/ready` returns 200 with a working database,
and the frontend loads on the service origin. Exercise the 503 path against a
disposable environment, not by interrupting a shared database.

The local failure-path check used the unchanged Sprint 1 server build. It did
not verify readiness against a connected database or a deployed Cloud Run service.

## Issue #17 containers (Guide Ep. 3, check C-03)

The seven starter-kit files were committed unchanged first (`88bd832`), then adapted. The diff shows each change:

| File | Adaptation |
| --- | --- |
| `Dockerfile` (root) | Names only, plus `server/prisma` copied before `npm ci`. Three stages: client build, server build, runtime as `node` on `$PORT` serving the API and the built SPA. CI and Cloud Run use this image. |
| `server/Dockerfile`, `server/docker-entrypoint.sh` | `prisma/` copied before `npm ci`, because `package.json`'s `postinstall` runs `prisma generate`. The entrypoint `exec`s the CMD, so Node receives SIGTERM. |
| `client/Dockerfile`, `client/nginx.conf` | Names only. nginx serves the SPA and proxies `/api` to `server:3000`. |
| `docker-compose.yml` | Extends the existing `db` service (`cpms` names, `127.0.0.1:5433`) with `migrate`, `server` and `client`. All ports are bound to `127.0.0.1`. **The demo seed stays opt-in:** `SEED_DEMO_DATA` defaults to `false`, and the demo passwords have no fallback, because F-03.1 says no default password is committed. The kit's `ADMIN_PASSWORD` / `DEMO_USER_PASSWORD` defaults were not copied. |
| `.dockerignore` | Also excludes `**/.env.*` and `**/coverage`. It applies only to `docker build .` (the root image). |
| `client/.dockerignore`, `server/.dockerignore` (new) | Compose builds `./client` and `./server` as separate contexts, where the root file does not apply. Both exclude `node_modules`, `dist`, `coverage`, `.env`, `.env.*` and `*.log`; no `.env.example` is needed by either build. Without them, `client/Dockerfile`'s `COPY . .` (after `npm ci`) copied host files into the build stage (review finding on PR #45). |

**C-03 result (6 Nov 2026, Docker 29.6.2, Compose v5.3.1, Windows).** Fresh clone of `build/17-docker` with no `.env`, only the committed defaults:

| Check | Result |
| --- | --- |
| `docker compose up --build -d` | exit 0, 45 s. `db`, `server` and `client` running; `migrate` exited (0) with `[seed] Demo data disabled.` |
| `curl --fail` `:3000/api/health`, `:3000/api/ready`, `:5173/api/ready` (through nginx) | `{"status":"ok"}`; `{"status":"ready","db":"connected"}` twice; all 200 |
| Seed opted in through a git-ignored `.env` (random passwords) | migrate exited (0) with `[seed] Demo fixtures ready.`; Supervisor and Student sign in through `:5173` (200) |
| Persistence | Supervisor creates milestone 1 "C-03 persistence check". After `docker compose down` and `up -d`, it is listed again and sign-in still works; the re-run seed rotated no password |
| Root image (`docker build .`) | 30 s. Run with `PORT=8080` against the same database: `/api/ready` 200, `/` and `/milestones/1` 200 (SPA), `/api/nope` gives the JSON 404. Runs as `node` |
| No secrets in images | Both images' `Config.Env` contain only `NODE_ENV`, `TZ`, `PORT` and the Node defaults. No password, secret or `DATABASE_URL` in the build history; no `.env` file in the image |

**First attempt failed:** `npm ci` stopped at the `postinstall` step with "Could not find Prisma Schema", because the kit copies `prisma/` after `npm ci`. Fixed in `ef1b781`.

**Developer checkout (7 Nov 2026).** The fresh clone has no local files to leak, so the check was repeated with host dependencies (`npm ci` on Windows in `client/` and `server/`) and dummy `client/.env` and `server/.env` files containing only a harmless marker:

| Image | Before the per-context `.dockerignore` files | After |
| --- | --- | --- |
| Client build stage | `/app/.env` present (the marker); 3 `win32` native packages (e.g. `@rolldown/binding-win32-x64-msvc`) and 20 `.cmd`/`.ps1` shims copied over the Linux install; context 98 MB | No `.env`, no `win32` package, no shim; context 1.6 kB |
| Server image | Already clean, because it copies only `package*.json`, `prisma`, `tsconfig.json`, `src` and the entrypoint | Clean, and the host files no longer enter the build context |

With the fix, `docker compose up --build -d` exited 0, `migrate` exited (0), `:3000/api/health`, `:3000/api/ready`, `:5173/api/ready` and `:5173/` returned 200, and Supervisor and Student signed in.

## Issue #18 — Pull-request CI (Guide Ep. 4, check C-01)

`.github/workflows/ci-docker.yml` runs on PRs targeting `main` or `staging/**`,
supports manual dispatch, and exposes `workflow_call` for the later deploy workflow.
The job ID stays **`test-and-docker`** so Issue #20 can select it as a required
status check after its first real run. The workflow uses only `contents: read`,
checks out without persisted credentials, pins all actions to full commit SHAs,
and receives no GCP credentials. It builds an image but does not push or deploy it.

| Gate | Verification |
| --- | --- |
| Deploy tooling | Bash syntax; summary-renderer tests; all deployment and release stub scenarios; Python smoke unit tests. No GCP calls. |
| Server | `npm ci`, explicit Prisma generation, committed migrations, opt-in CI seed, application/test typecheck, Vitest, production build. PostgreSQL 16 is an ephemeral runner service. Integration tests reset only `cpms_test`, not `public`. |
| Client | `npm ci`, Vitest and TypeScript/Vite production build. |
| Container | Build the root unified production Dockerfile as `cpms-ci:local`; do not publish it. |
| Evidence | Run Summary includes step outcomes and counts read from the actual server/client Vitest JSON reports. Test reports are uploaded for seven days, including on failure when available. Missing valid reports after a successful step fail the summary check. |

CI-only database and demo passwords are disposable fixture values, not live
credentials. They must never be reused for Cloud SQL or partner accounts. The
application's ordinary server/client tests remain unchanged. The browser E2E
suite is separate; this workflow does not claim to run it.

Local helper checks:

```bash
node --test scripts/ci-summary.test.mjs
bash -n deploy/deploy.sh deploy/release.sh deploy/teardown.sh
bash deploy/tests/test_deploy_stub.sh
bash deploy/tests/test_release_stub.sh
python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'
```

**C-01 acceptance is still pending a real GitHub run.** Record the staging PR,
its successful `test-and-docker` run and Summary, then the release PR into `main`
and its successful check. Do not label Issue #18 Done from local tests alone.
Issue #20 separately configures the active ruleset and demonstrates a blocked
merge with a failing temporary PR; adding this YAML does not enforce that gate.

Local verification on 13 November 2026: actionlint 1.7.12 accepted the workflow;
the summary-renderer tests passed 4/4; client tests passed 50/50 and the client
production build passed. Server typecheck and production build passed after
explicit Prisma generation. The developer ran the isolated verification helper;
its server JSON report records **209/209 passed**, with no failures or skips.
The helper uses a fresh disposable PostgreSQL container on port 15418 rather
than the existing development database. The developer supplied the helper's
final success line confirming that isolated server tests, typecheck/build,
summary tests, Linux deploy/release stubs, Python smoke tests and the unified
Docker build all passed. Each command is checked for a successful exit before
that line is printed. The Docker-dependent results are developer-run evidence;
the desktop sandbox itself cannot access the Docker Engine pipe. This local
verification does not replace the pending C-01 GitHub Actions runs.

## Issue #19 first deployment (Guide Ep. 5, check C-04)

### GCP project and resource names

Not secret; secret values live only in Secret Manager.

| Item | Value |
| --- | --- |
| Project ID | `cpe334-course-p-m-s` (Issue #15) |
| Region | `asia-southeast1` |
| Artifact Registry repository / image | `cpms` / `cpms` |
| Cloud SQL instance / database / user | `cpms-pg` (PostgreSQL 16, `db-f1-micro`, 10 GB SSD, storage auto-increase off) / `cpms` / `cpms` |
| Runtime service account | `cpms-runner`: Cloud SQL Client on the project, Secret Manager Secret Accessor on each `cpms-*` secret only |
| Secrets | `cpms-database-url`; with `--demo`: `cpms-student-demo-password`, `cpms-supervisor-demo-password` |
| Migration job | `cpms-migrate`: `npx prisma migrate deploy && npm run prisma:seed`, runs before the service is updated |
| Cloud Run service | `cpms`, port 3000, min 0 / max 3 instances, 512 MiB, public |

### Adaptations of the kit's `deploy/` scripts

The kit files were committed unchanged first, then adapted, so the diff shows each change.

| File | Adaptation |
| --- | --- |
| `deploy.sh` | `toktickit*` names became `cpms*`. **No admin password secret**, because this app has no admin role. `--demo` generates one password per demo role (`STUDENT_DEMO_PASSWORD`, `SUPERVISOR_DEMO_PASSWORD`, read by `server/prisma/demo-seed.ts`) and gives them to the migration job only; the service gets only `DATABASE_URL`. `--no-storage-auto-increase` is set when the instance is created, so Guide 5.4 is only a check. A secret counts as initialized only when its `latest` version is `ENABLED`, not when the secret merely exists, so a run interrupted between `secrets create` and `versions add` recovers on the next run. All secrets are inspected before anything changes, and the lookup fails closed: only a `NOT_FOUND` secret or one with no usable version gets new credentials; a permission, network or API error stops the run with no password, secret or deploy change (review of PR #46) |
| `smoke_test.py` | The kit's `/api/categories` check does not exist here, and every data endpoint needs sign-in. It is replaced by a sign-in with an unknown account, which must get `401 INVALID_CREDENTIALS`: that query needs the migrated `users` table (a missing table gives 500) and creates nothing. The optional `SMOKE_EMAIL`/`SMOKE_PASSWORD` login can use `smoke.student@example.test` |
| `release.sh`, `teardown.sh` | Same names as `deploy.sh`; teardown deletes our three secrets |
| `tests/` | Updated for the names. New assertions: no admin secret, both demo secrets granted and passed to the job in `--demo` mode, no demo password on the service, storage auto-increase off, a login that answers 500 fails the smoke test. Scenarios `empty` and `disabled` cover the retry after an interrupted run for the DB URL and both demo secrets; `demo_rerun` checks that usable credentials are kept; `denied`, `transient` and `transient_demo` check that a failed lookup exits 1 with no SQL password change, secret write or deploy |

Offline checks (stub `gcloud`/`openssl`, no GCP access): `bash deploy/tests/test_deploy_stub.sh`, `bash deploy/tests/test_release_stub.sh`, `python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'`.

### Running it (Cloud Shell, by the project owner)

**Prerequisite: deploy only a reviewed release on `main`.** Merging this PR into `staging/sprint-1` is not enough: `main` gets `deploy/` and the root `Dockerfile` only through the release PR `staging/sprint-1` → `main` and its tag. Run the commands below after that release is merged and tagged, and check out that tag, not the default branch head. Record the printed SHA in #19 and the Lab 5 PDF; it is the commit being deployed.

```bash
export PROJECT_ID=cpe334-course-p-m-s REGION=asia-southeast1
export RELEASE_TAG=v0.2.0          # the release tag on main that contains deploy/ (set to the real tag)
gcloud config set project "$PROJECT_ID"
git clone https://github.com/Nuggetkub/cpe334-course-project-management-system.git
cd cpe334-course-project-management-system
git checkout "$RELEASE_TAG" && git merge-base --is-ancestor HEAD origin/main && git rev-parse HEAD   # tag must be on main; record the SHA
test -f deploy/deploy.sh && test -f Dockerfile                                     # stop if either is missing
gcloud secrets describe cpms-does-not-exist                                        # read-only: the error must say NOT_FOUND
DRY_RUN=1 PROJECT_ID="$PROJECT_ID" REGION="$REGION" bash deploy/deploy.sh --demo   # creates nothing
PROJECT_ID="$PROJECT_ID" REGION="$REGION" bash deploy/deploy.sh --demo             # 10-20 min, costs start
gcloud sql instances describe cpms-pg --format='value(settings.storageAutoResize)' # must print False
```

Re-running `deploy.sh` is safe: a secret whose latest version is usable is kept, and a secret left without a usable version by an interrupted run gets a new one (for the database URL, together with a new password on the `cpms` user). If Secret Manager cannot be read (permission, network), the script stops before changing anything; fix the cause and run it again.

`--demo` is needed for C-04, because without it nobody can sign in. Never print, paste or screenshot a demo password; read one only when signing in, with `gcloud secrets versions access latest --secret=cpms-student-demo-password`.

**C-04 smoke check with a successful sign-in.** The unknown-account 401 check only shows that the `users` table can be queried. For C-04, also run the optional sign-in, which reads the password into the environment without printing it:

```bash
URL="$(gcloud run services describe cpms --region "$REGION" --format='value(status.url)')"
SMOKE_EMAIL=smoke.student@example.test \
SMOKE_PASSWORD="$(gcloud secrets versions access latest --secret=cpms-student-demo-password)" \
python3 deploy/smoke_test.py "$URL"     # expect PASS for login, /api/auth/me and logout
```
