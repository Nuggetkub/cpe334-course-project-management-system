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

Results will be added after actual red/green runs; no passing result is implied
by this contract.
