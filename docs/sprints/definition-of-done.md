# Product Definition of Done

| Version | Date | Author | Reviewer | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-06 | @Nuggetkub | @Earth2509 | Product-level DoD written down for D1 Part E. It collects the rules that each Sprint 1 feature contract's §5 already applied since 3 Nov; no rule is new |

A feature, and a release made of features, is **done** only when every item below holds and its evidence can be found. An AI agent's statement that something is done is not evidence.

| # | Done means | Evidence that shows it |
|---|---|---|
| 1 | **Required behaviour implemented.** Every acceptance criterion in the feature contract works in each layer it names (UI, API, database), and the contract says when a layer needs no change. | Contract §1–§3; the merged PR's diff |
| 2 | **Contract before code.** The contract (design, AC, STS) is committed before the tests and the implementation. Later changes add a version row giving the reason. | Commit order on the feature branch; contract version table |
| 3 | **Planned verification executed, test first.** Every STS row exists as an automated test, or as a named manual check, whose title starts with its TEST ID. Rule and permission tests are seen failing on behaviour before the implementation. A test that failed only because a module did not exist yet is reported as such, not claimed as behavioural red. | Red and green runs with command, counts and commit SHA in the PR or in contract §6 |
| 4 | **Meaningful tests passing.** On the PR head and again on the release commit, all of these pass: `server` typecheck, tests and build; `client` tests and build; root `npm run e2e`. No test is skipped, disabled or weakened to get there. | Test output tied to a commit; the release regression run |
| 5 | **Access enforced by the backend.** New endpoints use the F-02 guards in the order 401 → 403 → 404 → body. They are in the protected-endpoint list and have their own 403/404 tests. Hiding a button is never the only control. | TEST-02.1 and each feature's 403/404 tests |
| 6 | **Reviewed and integrated.** The other student reviews the PR into `staging/sprint-N` and records a specific check, question or finding. Authors never approve their own work. Findings are fixed or answered before merge. | PR review and approval on GitHub |
| 7 | **Released.** Integrated features reach `main` only through a reviewed release PR from sprint staging, after the full regression run. The release is tagged and staging is synced back. | Release PR, tag, GitHub release |
| 8 | **Setup and documents current.** The README (setup, environment variables, commands, API table), `.env.example`, traceability matrix, contribution table and AI-use declaration match the merged code. No secret is committed or shown. | Same PR as the change; AC-SR2.1 check |
| 9 | **Incomplete work disclosed.** Anything not done, any failed or skipped test, any deviation and any limitation is written down in the contract, the PR or the deliverable, never left implicit. | Contract "known limitations"; D1 Part F, F.9 |

For Sprint 1, the status of each feature against these items is in its contract's §5. The release-level evidence for `v0.1.0` is in D1 Part F.
