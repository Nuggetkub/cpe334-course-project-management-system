---
name: Defect
about: Report a defect (internal, UAT, or deployment finding)
title: "D-xx: "
labels: bug
---

## Defect
- ID: D-
- Source: internal / UAT (team, tester) / deployment
- Observed date/time and timezone:
- Release/tag, full commit and deployment revision tested:
- Live URL and how the running version was confirmed:
- UAT case ID / step / execution record (if applicable):
- Affected feature/requirement and contract link: F- / FR- / BR- / AC-
- Proposed severity: critical / major / minor / needs triage
- User impact and verified workaround (or not investigated):

<!-- A bug label means a reported defect, not an accepted triage decision.
For Lab 6 CPMS reports, we (the Product Team) add lab6 and uat on receipt.
Partner testers are not required to have label permissions; only bug is applied
automatically by this template. An accepted defect keeps bug and lab6, and we
retain uat for traceability. The Product Team records the decision below.
Keep StudyTrack product findings in its designated tracker/channel, not as CPMS bugs.
Do not include passwords, tokens, cookies, connection strings or private messages. -->

## Preconditions and synthetic inputs
- Browser/version:
- Account label, role and team/ownership (no credentials):
- Existing state, setup and exact synthetic inputs:

## Steps to reproduce
1.

## Expected result

## Actual result

## Persistence / denied-operation check
- After reload or a rejected operation, what record/data was checked?
- Was protected data changed or revealed? Evidence:
- Reproduction frequency / number of attempts actually observed:

## Evidence
<!-- Masked logs, safe API response or screenshot with evidence ID, date and case step.
For Lab 6, link the relevant register row in docs/labs/lab06/findings.md.
Do not claim an unexecuted case as PASS or a missing report as zero defects. -->

## Triage decision
- Status: pending triage / needs information / final
- Classification: accepted defect / duplicate / not a defect / enhancement
- Contract-based rationale (or question still awaiting an answer):
- Duplicate/original link, if applicable:
- Confirmed severity, owner and next action:

## Resolution
- Regression test and actual RED commit/result: TEST-
- Fix PR: #
- GREEN and regression commands/results:
- Fixed in release (commit/revision, deploy and smoke evidence):
- Independent UAT re-test (tester/team, date, version, case/step, actual result/evidence):
- Final disposition / limitation acknowledged by the UAT Team:

<!-- Preserve the initial failure and link a separate retest execution.
Product Team verification or passing CI is not an independent UAT retest.
Critical/major defects block acceptance; minor limitations require an explicit disposition.
Do not deploy during grading/UAT without the required TA and partner coordination. -->
