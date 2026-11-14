# Issue #21 — Automatic release and C-06 evidence

## Reviewed starting point

- Target: `main`; source: `release/21-auto-deploy-main`, based on
  `staging/sprint-1` merge `c77da87` ([PR #53](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/53)).
- `main` at preparation: `0b17151` (`v0.2.1`), already an ancestor of staging.
- [Staging CI 43554168192](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/43554168192)
  passed for `a5a36cc`, the branch-sync merge reviewed in PR #53.
- This release adds the deployment workflow and running-commit check. It adds
  no Prisma migration and does not change the existing seed implementation.
- The release branch also updates documentation; it does not change GCP IAM,
  secrets, resource limits or database settings.

## Before merging the release PR

Local preparation checks on 14 November 2026, on the release branch based on
`c77da87` (the additional edits are documentation only):

| Check | Result |
| --- | --- |
| Client Vitest | 7 files, 50 tests passed |
| Server application/test typecheck and production build | Passed |
| Client TypeScript/Vite production build | Passed |
| CI summary unit tests | 4 passed |
| Python smoke unit tests | 6 passed |
| actionlint 1.7.12, CI and deploy workflows | Passed |

The database-backed server suite and Docker build were not rerun locally for
these documentation edits. The linked staging CI includes both; the new release
PR must pass its own required CI check. No live deployment result is claimed.

- [ ] Teammate reviews the release diff into `main`.
- [ ] Required `test-and-docker` check succeeds on the current release head.
- [ ] The branch includes current `main`; synchronize through the protected PR
  process if `main` advances.
- [ ] Release owner confirms readiness to update the shared demo service.

Merging into `main` starts **Deploy demo** automatically. It builds and pushes an
image, executes the existing migration/opt-in seed job, and updates public Cloud
Run traffic. This is a live update, not another offline CI check. Do not merge a
second release while collecting the first release's evidence.

## First automatic deployment: record actual results

1. Open the `Deploy demo` run for the **main merge commit**, not the feature or
   release-branch head. Record its full SHA and run URL.
2. Confirm the reusable CI job passes and keyless WIF authentication succeeds.
3. Confirm image push, migration job execution, service update and smoke test all
   succeed. Keep the migration execution name and its success status.
4. Copy the image tag, immutable digest and service URL from the run Summary.
   The full-SHA tag must equal the main merge commit.
5. In Cloud Run, verify the serving revision uses that digest and receives 100%
   traffic. Verify `/api/health` reports the same main commit and `/api/ready`
   returns HTTP 200 with `db: connected`.
6. Record the checks below in Issue #21. Keep passwords, auth tokens and secret
   values out of logs, screenshots, comments and the report.

| Evidence | Actual result |
| --- | --- |
| Release PR and main merge SHA | Awaiting reviewed release |
| Deploy demo run URL and conclusion | Not run by this preparation |
| WIF authentication | Awaiting first main workflow run |
| Image tag and digest | Awaiting image push |
| Migration job execution | Awaiting workflow execution |
| Serving revision, digest and traffic | Awaiting Cloud Run verification |
| Health commit, readiness and UI | Awaiting live smoke checks |

These entries are a collection checklist, not passing evidence. Optional login
smoke checks remain optional; do not describe `SKIP login` as a successful login.

## Second release: visible-change proof (C-06)

After the first deployment passes, create `feature/21-deploy-proof` from current
staging. Add a small, clearly labelled UI change with a matching test, without
changing authorization, data or credentials. Record the visible text before and
after. Use a teammate-reviewed feature PR into staging, followed by a reviewed
release PR into `main` and the required CI checks.

Record the second main merge SHA, its successful `Deploy demo` run, image digest,
serving revision, matching health commit and the visible UI change. Only after
this chain is verified should Issue #21 be closed and its Project status become
Released. Until then it remains open, even though PR #53 is in staging.

## Failure and rollback boundaries

- Failed CI prevents normal deployment. A failed migration prevents the release
  script from updating the service; investigate the run before retrying.
- A smoke failure after the service update is **not** an automatic rollback.
  Inspect the current revision and health before deciding on recovery.
- Manual rollback uses `Deploy demo` on `main` with `image_tag` set to a known
  existing full SHA. It skips CI/build/migration/seed and still checks the running
  commit. A pre-workflow image reporting `unknown` will not satisfy that check.
- Rollback does not restore the database. Keep migrations additive and coordinate
  persistence/rollback evidence with Issue #22; do not run local test-schema reset
  commands against Cloud SQL.
