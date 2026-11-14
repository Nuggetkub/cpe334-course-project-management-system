# Issue #21 — Visible deployment change contract

## Scope and acceptance

Base: reviewed main `297dafe` (release PR #54). Target: `staging/sprint-1`,
then a separate reviewed release PR into `main`.

- Before: the public Sign in page shows the product name with no release label.
- After: immediately below the product name, show the static text
  **Lab 5 deployment demo — release 2** in a labelled `Release information` region.
- The label is ordinary text, not a success/verification indicator or a live SHA.
  `/api/health` remains the source for the actual running commit.
- Email/password inputs, validation, session handling and navigation are unchanged.
  No API, database, seed, credentials, workflow permissions or GCP changes.
- The marker uses existing paragraph styling and wraps normally on narrow screens.

## Tests planned before implementation

`client/tests/deploy-proof.test.tsx`:

1. `TEST-C06.1`: anonymous Sign in exposes the exact marker in a named region,
   keeps the labelled inputs and button, and sends no request just to render it.
2. `TEST-C06.2`: successful sign-in leaves the login screen; the marker is not
   presented as a global application status.

Extend the existing browser login journey with an exact visible-marker assertion
before entering credentials. Existing auth regression tests must remain green.

## Evidence boundary

The first automatic deployment's Actions run
[43602099175](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/43602099175)
passed for main `297dafe897445b8fd3993accf5a284005832349d`. Its WIF,
build/push, migration/deploy and smoke steps succeeded. Independent public HTTP
checks on 14 November 2026 confirmed health reports that SHA, readiness returns
`db: connected`, and the HTML loads (all HTTP 200).

The second deployment has not happened. A passing component/browser test does not
prove Cloud Run is serving the new marker. After both reviewed PRs, record the
second main SHA, deployment run, image digest, migration execution, serving
revision/traffic and the visible label from the public URL. Do not close #21 yet.

## Verification record

- Contract/test commit `ceeddc8`: `npm --prefix client test --
  tests/deploy-proof.test.tsx` exited 1, with both tests failing on the missing
  release region/text. No import or environment failure caused this red result.
- After adding the marker, `npm --prefix client test` exited 0: **8 files,
  52 tests passed**, including both new tests and the existing auth regression.
- `npm --prefix client run build` exited 0 (TypeScript and Vite).
- Developer-run browser verification: `npm run e2e -- e2e/auth.spec.ts
  --reporter=list` completed with **2 passed (15.4s)**. The supplied output lists
  the updated login/logout/lockout journey (`TEST-01.7b`, including the exact
  release marker assertion) and generic wrong-password message (`TEST-01.8b`).
  The developer ran this against the disposable `cpms_e2e` schema after installing
  the root Playwright dependencies; this is developer-supplied terminal evidence,
  not an independent sandbox rerun or a Cloud Run check.
- No CSS or server changes were needed. No claim of a second live release is made.
