# Issue #21 — Automatic release and C-06 evidence

## Release A preparation (historical)

- Target: `main`; source: `release/21-auto-deploy-main`, based on
  `staging/sprint-1` merge `c77da87` ([PR #53](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/53)).
- `main` at preparation: `0b17151` (`v0.2.1`), already an ancestor of staging.
- [Staging CI 43554168192](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/43554168192)
  passed for `a5a36cc`, the branch-sync merge reviewed in PR #53.
- This release adds the deployment workflow and running-commit check. It adds
  no Prisma migration and does not change the existing seed implementation.
- The release branch also updates documentation; it does not change GCP IAM,
  secrets, resource limits or database settings.

## Pre-release verification (recorded before PR #54)

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
these documentation edits. The linked staging CI includes both. These local
preparation results are separate from the subsequent live runs below.

- [x] Teammate reviewed release PR #54 and merged it into `main`.
- [x] Required CI passed; the release included then-current `main`.
- [x] Live release A workflow completed successfully.

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
| Release PR and main merge SHA | PR #54 merged: `297dafe897445b8fd3993accf5a284005832349d` |
| Deploy demo run URL and conclusion | [43602099175](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/43602099175), success |
| WIF authentication | Keyless authentication step succeeded in that run |
| Image tag and digest | Full-SHA tag equals the main merge SHA; owner records digest prefix `sha256:12c8359c20e3…` in the linked evidence |
| Migration job execution | Owner records `cpms-migrate-2mqvh`, succeeded |
| Serving revision, digest and traffic | Owner records `cpms-00003-lx9`, 100% traffic at release A verification |
| Health commit, readiness and UI | Independent HTTP checks on 14 Nov: health reports the full `297dafe` SHA, readiness reports `db: connected`, root HTML loads; all HTTP 200 |

The Cloud Run identifiers above come from the
[project owner's evidence record](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/21#issuecomment-6881304126),
not an independent authenticated Cloud Run inspection. Digest prefixes in this
document are abbreviated for reference, not complete deployment inputs.
The public service is https://cpms-137792226556.asia-southeast1.run.app . Optional
login smoke checks remain optional; do not describe `SKIP login` as a successful
login.

## Second release: visible-change proof (C-06)

Feature PR #55 was reviewed by @Nuggetkub and merged into staging as `dab69e4`.
Release PR #56 was reviewed by @Earth2509 and merged into main as
`fda467204f8209b1ee11fb1176765d608e3b4dbe`. The release tree matches the reviewed
feature head `eb07374`; client tests 52/52 and build were independently rerun on
`dab69e4` before approval. Required CI run 43615575031 passed.

| Evidence | Release B result |
| --- | --- |
| Automatic trigger | Push to main after PR #56; no manual deploy command |
| Deploy demo | [43617566286](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/43617566286), success; independently checked through Actions API |
| CI, WIF, image push, migration/deploy and smoke | Both CI and deploy jobs completed successfully |
| Image tag / digest | Owner records tag equal to the full main SHA; digest prefix `sha256:eeac97e17b1a…` |
| Migration execution | Owner records `cpms-migrate-j8v8c`, succeeded |
| Serving revision | Owner records `cpms-00004-49r`, 100% traffic at release B verification |
| Running commit | Owner records `PASS running commit fda4672…` and the matching health SHA |
| Visible change | Owner records login before (14 Nov 23:12 ICT, no marker) and after (15 Nov 00:00 ICT, `Lab 5 deployment demo — release 2`) |

Cloud Run identifiers and before/after visual evidence are attributed to the same
[owner record](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/21#issuecomment-6881304126).
The owner closed Issue #21 as Released after recording this chain.

### Current runtime versus historical release evidence

The first independent HTTP recheck on 15 November caught the middle of Issue #22:
health reported release A `297dafe…`, with connected readiness. The exercise then
completed its roll-forward back to B. The
[Issue #22 closing record](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/22#issuecomment-6881938175)
documents both steps:

| Manual step | Run | Selected `image_tag` | Revision at 100% (owner evidence) |
| --- | --- | --- | --- |
| Rollback to A | [43621609806](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/43621609806) | `297dafe897445b8fd3993accf5a284005832349d` | `cpms-00005-xxf` |
| Roll-forward to B | [43623678634](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/43623678634) | `fda467204f8209b1ee11fb1176765d608e3b4dbe` | `cpms-00006-bhh` |

Both manual runs succeeded, independently checked through the Actions API, with
`test` skipped and `deploy` successful. The owner's step evidence records that
build was skipped and `release.sh` reused the existing image without migration or
seed. The Summary calls both operations `Rollback: true`, including roll-forward,
because both use the manual existing-image path.

After roll-forward, a fresh independent HTTP check on 15 November returned HTTP
200 for both endpoints: health reported full SHA
`fda467204f8209b1ee11fb1176765d608e3b4dbe`, equal to main at verification, and
readiness reported `db: connected`. The owner records serving revision
`cpms-00006-bhh` at 100% and the restored release-2 label. Cloud Run revision,
traffic and data-persistence assertions are attributed to the linked owner record,
not to the public HTTP check.

Neither manual run counts as a third automatic C-06 release. A manual run's
`head_sha` identifies the workflow source on main, not necessarily its selected
image tag. The earlier A response remains a historical mid-exercise observation,
not the final serving state. No rollback or roll-forward was initiated while
preparing this documentation update.

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
