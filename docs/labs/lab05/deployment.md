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
