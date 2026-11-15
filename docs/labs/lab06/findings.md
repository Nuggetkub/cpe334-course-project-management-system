# UAT findings and triage register (Lab 6 Part C)

Related Issue: [#62](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/62). Owner: Earth2509; reviewer: Nuggetkub. Fix/retest work: [#63](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/63).

Prepared 15 November 2026 (ICT). **Preparation only; no findings have been entered or triaged.** Partner execution is awaiting its handoff; receipt of findings about CPMS is not yet recorded. These empty registers do not mean either product has passed or that there are no defects.

## 1. Reporting a finding in StudyTrack (outgoing)

Create one report per distinct observed failure using [finding-report-template.md](finding-report-template.md). Link the exact [execution record](uat-results.md), agreed release and contract/AC. Give reproducible inputs/steps, expected versus actual behavior, evidence and user impact. Send it to the partner's designated issue tracker or agreed channel; do not create accepted CPMS bug issues for failures in their product.

Separate defects (violations of the agreed scope/contract) from enhancements (new behavior beyond it). A FAIL is an observation pending triage, not automatic proof of a defect. Record unavailability/access problems as BLOCKED execution and coordinate promptly, including a TA notification when required.

| Finding ID | Partner case / execution | Tested release | Report / evidence | Proposed severity and impact | Partner disposition / reason | Delivery / retest |
| --- | --- | --- | --- | --- | --- | --- |

No outgoing findings are recorded yet. Do not add a fabricated example as an actual finding.

## 2. Findings received about CPMS (incoming)

Preserve every received finding, even duplicates or rejected reports. A receipt record identifies the reporter/team, date, tested release and original report. Do not rewrite the original observation to match a later fix.

| Finding ID / original report | Reporter / received (ICT) | CPMS version / case | Classification | Contract / AC and reason | Severity / owner | Bug / fix / retest / disposition |
| --- | --- | --- | --- | --- | --- | --- |

No incoming findings have been entered. Once the agreed UAT session is completed, explicitly record its date, report/source and whether findings were received. A confirmed zero-finding result must cite that completed session/partner response; absence of messages is not enough.

### Classification and severity

| Classification | Required reasoning / next action |
| --- | --- |
| Accepted defect | Observable behavior violates the agreed Sprint 1 contract on the stated release; cite the AC and create a separate CPMS issue with `bug` and `lab6` labels. |
| Duplicate | Link the original finding/bug and explain the matching behavior; retain this reporter's evidence and cross-reference the original retest. |
| Not a defect | Cite the contract/scope and evidence explaining the actual behavior. Missing reproduction is a request for information, not grounds to silently reject the report. |
| Enhancement | Explain why the requested behavior extends the agreed Sprint 1 scope; track separately from acceptance-blocking defects. |

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

If no legitimate defect is found, ask the TA for the controlled-defect exercise described in #63. Do not invent defects, intentionally break the live release, or claim a retest that did not occur.

## 4. Completion checks for Issue #62

- [ ] Every outgoing observed failure has a reproducible report and delivery reference.
- [ ] Every received finding (including duplicates/enhancements) has a traceable row and reasoned final classification.
- [ ] Every accepted CPMS defect has a `bug` + `lab6` Issue, severity, owner, fix status and disposition.
- [ ] Critical/major blockers and outstanding retests remain explicit; minor limitations have a fix or independent acceptance.
- [ ] Any zero-finding statement cites the completed session and partner acknowledgement.
- [ ] Nuggetkub reviewed the completed register. Template preparation alone does not close #62.
