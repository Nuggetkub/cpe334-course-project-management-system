# AI-Use Declaration

Both students used AI coding assistants. Every AI-produced change went through the same gate as any other change: a contract first, tests run locally against disposable schemas, and a PR approved by the other student. Test results quoted in this project come from commands actually run, not from an assistant's claim.

| Date | Tool | Task assisted | Verified by |
|---|---|---|---|
| 2026-11-03 | Claude Code | Read project specs; drafted project plan, repository scaffold, Issue/PR templates, board setup | 67070501046 |
| 2026-11-03 to 06 | Claude Code (@Nuggetkub) | Drafted SRS, feature inventory and traceability; F-01, F-02, F-05 and F-06 contracts, failing tests and implementations; review comments on @Earth2509's PRs; release PR | 67070501046 read and ran each change; @Earth2509 reviewed every PR |
| 2026-11-05 | OpenAI Codex | Assisted @Earth2509 with F-04 contract, additive migration, API/UI and automated tests. Tests run locally against isolated schemas; verification and TDD limitations recorded in the F-04 contract. | Automated local checks; @Nuggetkub peer review (PR #35, approved) |
| 2026-11-04 to 06 | OpenAI Codex (@Earth2509) | F-03 data seed and protected team views (PRs #28, #32, #34), system design and sprint plan (#30), milestone implementation and tests (#35), cloud-readiness audit (#38), and PR reviews | 67070501069 ran the server, client and E2E suites locally and checked the terminal results, including the timed fresh-clone retry (TEST-SR2.2); @Nuggetkub peer review of each PR |
| 2026-11-06 | Claude Code (@Nuggetkub) | D1 evidence: ran the regression suite on `v0.1.0`; a temporary Playwright script captured the Part F screenshots and API responses from the real app on the disposable `cpms_e2e` schema; drafted Part F and assembled the PDF | 67070501046 checked every screenshot and result; @Earth2509 reviews the evidence PR |
| 2026-11-13 | OpenAI Codex (@Earth2509) | Issue #18 PR/reusable CI workflow, deploy-tooling checks and tested JSON-report summary; adapted the Lab 5 kit to CPMS without cloud deployment | Local workflow lint, summary tests 4/4, client tests 50/50 and builds; developer-run isolated helper confirmed server tests 209/209, Linux deploy/release stubs, Python smoke tests and Docker build. GitHub-run acceptance and peer review remain pending. |
