# UAT findings and triage register (Lab 6 Part C)

Related Issue: [#62](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/62). Owner: Earth2509; reviewer: Nuggetkub. Fix/retest work: [#63](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/63).

Prepared 15 November 2026 (ICT); updated 22 November 2026. **Baseline: no findings in either direction.** StudyTrack ran our six CPMS cases twice (plus supplemental X01–X03), and we ran their four cases: all PASS. **Part D controlled exercise (the TA's procedure for teams with no UAT defects):** we reported F1 against StudyTrack's exercise build (section 1), and StudyTrack reported #70 against ours (section 2). Both were fixed and independently retested PASS (section 3). **StudyTrack's final Sprint 1 decision for CPMS `v0.3.0` (`b6cffa1`, `cpms-00007-7r8`): Accepted for the tested scope** (Datakung on [#70](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/70#issuecomment-7079679438), 22 Nov 2026 20:15 ICT; testers auto4496 and Datakung).

## 1. Reporting a finding in StudyTrack (outgoing)

Create one report per distinct observed failure using [finding-report-template.md](finding-report-template.md). Link the exact [execution record](uat-results.md), agreed release and contract/AC. Give reproducible inputs/steps, expected versus actual behavior, evidence and user impact. Send it to the partner's designated issue tracker or agreed channel; do not create accepted CPMS bug issues for failures in their product.

Separate defects (violations of the agreed scope/contract) from enhancements (new behavior beyond it). A FAIL is an observation pending triage, not automatic proof of a defect. Record unavailability/access problems as BLOCKED execution and coordinate promptly, including a TA notification when required.

| Finding ID | Partner case / execution | Tested release | Report / evidence | Proposed severity and impact | Partner disposition / reason | Delivery / retest |
| --- | --- | --- | --- | --- | --- | --- |
| **F1** (Part D exercise) | ST-X05 step 3 at 390×844 (also ST-X03 s1, s3, s4, s7 at desktop); AC-F03-08 | `832b8c8` / `studytrack-partd-g832b8c8-exercise` (partner-reported) | [studytrack#73](https://github.com/auto4496/studytrack/issues/73), filed 21 Nov 22:00 ICT by Nuggetkub; images F1-1 to F1-4 | **Minor**: a valid 100-character title with no spaces isn't wrapped on the goal page (cut off at 390×844; overlaps `Active` and adds a horizontal scrollbar at desktop); a 500-character template description overflows `/goals/new` (F1-3). Layout only, no data loss | Fixed in [StudyTrack PR #74](https://github.com/auto4496/studytrack/pull/74). F1-1/F1-2 came from their planted change; F1-3 was an additional real finding fixed in the same PR | Retested by Nuggetkub 22 Nov 14:51–15:05 on `1aae2de` / `studytrack-partd-g1aae2de-fix`: **4/4 PASS** ([#73 comment](https://github.com/auto4496/studytrack/issues/73#issuecomment-7076330686)); fix accepted. F1-3 recorded as a minor limitation of `ef0de7f` ([uat-results.md section 5](uat-results.md#5-part-d-blind-run-of-studytracks-exercise-build-retest-and-decision)) |

**No outgoing findings against the baseline release.** All four StudyTrack cases (ST-UAT-01 to ST-UAT-04) passed against the agreed release, tag `uat-lab6-2026-11-18` (`ef0de7f`, revision `studytrack-gef0de7f877dc-r44090861325-1`; serving during the run windows confirmed by StudyTrack's Cloud Run audit-log evidence, [StudyTrack PR #71](https://github.com/auto4496/studytrack/pull/71) (merged `ff459b4`)), executed 19 November 2026 with rechecks on 20 November 2026; see the [execution register](uat-results.md#3-case-register). Every step matched the partner's expected result, so there was no FAIL to triage. This zero-finding statement cites that completed run; StudyTrack acknowledged it on 20 Nov 2026 ([uat-results.md section 4](uat-results.md#4-delivery-and-completion)).

## 2. Findings received about CPMS (incoming)

Preserve every received finding, even duplicates or rejected reports. A receipt record identifies the reporter/team, date, tested release and original report. Do not rewrite the original observation to match a later fix.

Use the existing [GitHub Defect issue template](../../../.github/ISSUE_TEMPLATE/defect.md) for a reported CPMS defect; it includes the tested version, case/step, inputs, evidence and independent retest fields. Its default `bug` label identifies a report, **not an accepted classification**. Only `bug` is applied automatically by this template. We (the Product Team) add `lab6` + `uat` when a report arrives, record every report below, and explicitly decide its classification. The partner instructions in [uat-cases.md](uat-cases.md) ask for `uat`; partner testers do not need label permissions, because we apply it for them. An accepted defect keeps `bug` + `lab6`, and we retain `uat` for traceability. A partner can also report through Discord as allowed by the handoff; Earth2509 records the source and creates/links the tracking issue without publishing private message contents. Do not require a partner to have repository write access just to report a finding.

| Finding ID / original report | Reporter / received (ICT) | CPMS version / case | Classification | Contract / AC and reason | Severity / owner | Bug / fix / retest / disposition |
| --- | --- | --- | --- | --- | --- | --- |
| [#70](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/70) "Feedback containing only spaces is saved" (Part D exercise) | auto4496, 21 Nov 21:49; reproduced independently by Datakung 22:04 | `4e38aac` on the isolated service `cpms-partd` (revision `cpms-partd-00001-nss`); UAT-03 step 5 | **Accepted defect** (the controlled defect planted in [#69](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/69); not present in `b6cffa1`) | Violates **AC-06.2 / BR-10**: feedback must be 1–2000 characters after trimming. Three spaces were saved as a blank entry and shown to students | **Minor** (invalid blank entry; no data loss; workaround) / Nuggetkub | Fixed in [#71](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/71), merged `406016f`, deployed `cpms-partd-00002-zsc`, **retest PASS** by Datakung 22 Nov 17:56; closed 22 Nov (section 3) |

**No incoming findings against the baseline release.** StudyTrack's results for CPMS were received on 20 November 2026 (by 17:13 ICT) by Discord DM to Nuggetkub and Earth2509 (message "Lab 6 UAT results for CPMS"; contents not published here). Public evidence: [first-run results](https://github.com/auto4496/studytrack/blob/0a0e6925f01f5b138ed33935b4bb0d0ffbb68cb6/artifacts/evidence/lab06/cpms-first-run/results.md) and [StudyTrack PR #70 review with the repeat-run summary](https://github.com/auto4496/studytrack/pull/70#pullrequestreview-5990160290).

| Run | StudyTrack tester | Dates (ICT) | CPMS version / cases | Result |
| --- | --- | --- | --- | --- |
| First run | auto4496 | 18–19 Nov 2026 | `v0.3.0` (`b6cffa1`, `cpms-00007-7r8`); [uat-cases.md @ `2f45da0`](https://github.com/Nuggetkub/cpe334-course-project-management-system/blob/2f45da0ddab41ceb8471ac8903953f61d7d26acf/docs/labs/lab06/uat-cases.md) | UAT-01 to UAT-06 PASS (6/6) |
| Repeat run, fresh fixtures | Datakung | 19–20 Nov 2026 | same | UAT-01 to UAT-06 PASS (6/6), 33/33 required steps |

Both StudyTrack testers used OpenAI Codex for browser actions and evidence capture. Coverage notes from StudyTrack: the *Optional* step of UAT-02 (submitting from a form left open past the deadline) was not run; the HTTP 403 checks are covered by our automated tests, as stated in [uat-cases.md](uat-cases.md). The cited case document at `2f45da0` is identical to the current one. StudyTrack recorded `/api/health` returning `b6cffa1` at [19 Nov 23:17 ICT](https://github.com/auto4496/studytrack/blob/0a0e6925f01f5b138ed33935b4bb0d0ffbb68cb6/artifacts/evidence/lab06/cpms-first-run/version-end-20261119.json).

**CPMS serving revision during StudyTrack's runs: confirmed by an owner-reported check.** Nuggetkub (project owner) ran read-only `gcloud` commands on 20 Nov 2026 (about 17:40 ICT); the redacted, transcribed output is in [evidence/cpms-serving-revision.md](evidence/cpms-serving-revision.md). It shows traffic is 100% on the latest revision, `cpms-00007-7r8`, and no newer revision exists. The Cloud Run admin activity audit log shows no change after the `v0.3.0` deploy on 15 Nov 2026 04:50–04:51 UTC (one `ReplaceJob` for `cpms-migrate` and two `ReplaceService` calls for `cpms`). So `cpms-00007-7r8` served 100% of traffic for the whole of 18–20 Nov. No reviewer has re-run these commands independently.

Synthetic data StudyTrack left in CPMS: milestones #4–#7 (first run) and #8–#11 (repeat run, suffix `-r2-20261119-B`).

**StudyTrack's final Sprint 1 decision for CPMS: Accepted for the tested scope**, recorded by Datakung on [#70](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/70#issuecomment-7079679438) on 22 Nov 2026 (20:15 ICT). Basis: auto4496's 6/6 run (18–19 Nov), Datakung's 6/6 run (19–20 Nov), supplemental CPMS-X01–X03 PASS (21 Nov) and the #70 retest PASS. Condition noted: CPMS-X04 was not run because no unassigned Student account was handed out (AC-03.4 is covered by automated tests, [uat-cases.md section 3](uat-cases.md#3-covered-by-automated-tests-only-not-executed-by-the-uat-team)). Because no defect was found in either direction, the Part D fix/retest work used the TA's controlled-defect procedure ([#63](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/63)); the exercise finding received is #70 above.

### Classification and severity

| Classification | Required reasoning / next action |
| --- | --- |
| Accepted defect | Observable behavior violates the agreed Sprint 1 contract on the stated release; cite the AC and create a separate CPMS issue with `bug` and `lab6` labels. |
| Duplicate | Link the original finding/bug and explain the matching behavior; retain this reporter's evidence and cross-reference the original retest. |
| Not a defect | Cite the contract/scope and evidence explaining the actual behavior. Missing reproduction is a request for information, not grounds to silently reject the report. |
| Enhancement | Explain why the requested behavior extends the agreed Sprint 1 scope; track separately from acceptance-blocking defects. Never relabel a failing Sprint 1 requirement as an enhancement; reproduce and clarify before dismissing. |

Pending triage / needs information is a temporary status, not a final classification. Record the question, owner and follow-up date until a reasoned disposition is available.

| Severity | User impact and acceptance rule |
| --- | --- |
| Critical | Unauthorized disclosure/change, data loss or broadly unusable core journey; blocks acceptance. |
| Major | A required core behavior fails or a role cannot complete its required journey; blocks acceptance. |
| Minor | Limited impact with a practical workaround and no critical/major consequence; fix or obtain explicit UAT-team acceptance as a known limitation. |

Judge by observed impact, not implementation effort. Agree disputed severity with the partner and retain the rationale; ask the TA when required. Do not downgrade a release blocker merely to produce an Accepted decision.

## 3. Accepted-defect lifecycle and independent retest

1. Link an accepted CPMS defect to its own `bug` + `lab6` Issue with severity, owner, reproduction and contract reference.
2. Under #63, reproduce it with a failing regression test, record RED on the actual commit, fix it, and record GREEN plus full-suite results. Report setup/import failures honestly rather than calling them behavioral RED.
3. Teammate review and passing CI precede merge into staging. No author approves their own fix.
4. Before a release to main, coordinate with the partner and check with the TA whether deployment is allowed during Lab 5 grading. Do not deploy just to publish these documentation templates.
5. Record the reviewed release PR, deployed commit/revision and smoke result. Keep the original tested release separate from the fix release.
6. StudyTrack independently reruns the relevant cases and regression scope and records actual results, tester names, version and date. A Product Team test or CI pass does not substitute for independent retest.
7. Record the UAT team's explicit final decision: Accepted, Accepted with minor limitations, or Not Accepted. Link unresolved limitations and their acknowledgement. Keep #63 open until its completion conditions are met.

| Accepted CPMS bug | RED commit / result | Fix PR / GREEN and regression | Release / smoke | Independent retest record | Final disposition |
| --- | --- | --- | --- | --- | --- |
| [#70](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/70) (controlled exercise, Minor) | `b8e2f13`: new client test TEST-06.2d (#70) fails locally (1 failed / 5 passed); server TEST-06.2a fails (2 failed / 8 passed); CI [44921453002](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/44921453002) RED, server 4 failed / 206 passed | [#71](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/71): fix `ab28af3` restores `.trim()` in the client form and the server validator; CI [44921648373](https://github.com/Nuggetkub/cpe334-course-project-management-system/actions/runs/44921648373) GREEN: server 210/210, client 53/53, Docker build. Reviewed, approved and merged by Earth2509 as `406016f` | `406016f` deployed to the isolated service `cpms-partd`, revision `cpms-partd-00002-zsc` (image `sha256:7560e8e0…`), 22 Nov about 17:16 ICT; `/api/health` reports `406016f`; live `cpms` still `b6cffa1`. Smoke at 17:19: three spaces rejected | Datakung (StudyTrack), 22 Nov 17:56 ICT on `406016f`: UAT-03 step 5 PASS and the padded-feedback regression PASS ([#70 comment](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/70#issuecomment-7078257188)) | Fix accepted; #70 closed. Not released to `main`: `main` never contained the defect and serves the graded baseline `b6cffa1` |

If no legitimate defect is found, ask the TA for the controlled-defect exercise described in #63. Do not invent defects, intentionally break the live release, or claim a retest that did not occur.

## 4. Completion checks for Issue #62

- [x] Every outgoing observed failure has a reproducible report and delivery reference (F1 → studytrack#73).
- [x] Every received finding (including duplicates/enhancements) has a traceable row and reasoned final classification (#70).
- [x] Every accepted CPMS defect has a `bug` + `lab6` Issue, severity, owner, fix status and disposition (#70).
- [x] Critical/major blockers and outstanding retests remain explicit; minor limitations have a fix or independent acceptance (none open).
- [x] Any zero-finding statement cites the completed session and partner acknowledgement.
- [ ] Nuggetkub reviewed the completed register. Template preparation alone does not close #62.
