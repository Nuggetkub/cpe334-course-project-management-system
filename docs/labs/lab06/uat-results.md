# Partner UAT execution register (Lab 6 Part B)

Related Issue: [#61](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/61). Owners/testers: Earth2509 and Nuggetkub; reviewer: Nuggetkub.

## Current execution status

Prepared 15 November 2026 (Asia/Bangkok). **NOT STARTED: the StudyTrack UAT handoff has not been received**, as confirmed by Earth2509 on this date. There are no executed cases or acceptance results in this register. An empty register is not a claim of zero defects or a passing product.

Partner: [StudyTrack](https://github.com/auto4496/studytrack), Theme 8; auto4496 and Datakung. The public repository is context only: its current main branch, Sprint 1 tag and previous cloud URL must not be assumed to identify the release agreed for UAT. Sprint 2/3 work is outside the agreed Sprint 1 scope unless both teams explicitly revise the scope.

## 1. Handoff and session prerequisites

Record the source and confirmation for each item before starting. Do not invent cases on the partner's behalf or turn a preliminary inspection into an executed UAT case.

| Required item | Status / value | Source or confirmation |
| --- | --- | --- |
| Partner case document and immutable version/link | Awaiting partner | Not received |
| Accepted Sprint 1 scope and contract/AC links | Awaiting confirmation | Not received |
| Exact tested tag/full commit and deployment revision | Awaiting partner | Not received |
| Live URL and a way to verify the running version | Awaiting partner | Not received |
| Account labels, roles and ownership boundaries | Awaiting partner | Not received |
| Credentials delivered through the agreed private channel | Awaiting partner; do not record values here | Not received |
| Synthetic inputs, fixtures, timezone and setup/cleanup rules | Awaiting partner | Not received |
| First-run session, correction window and independent retest session (ICT) | To be agreed under Issue #59 | Not recorded |
| Both CPMS testers' allocation / attendance | To be recorded | Not yet executed |

Check the agreed release at session start and again if a version change is reported. If it cannot be established, record the affected cases as BLOCKED with evidence and ask the partner to confirm it. Do not infer a commit from an HTTP 200 response or an unversioned health response. Coordinate with the partner and notify the TA promptly if access or availability prevents the required testing; record the notification link/date without private message contents or credentials.

## 2. Execution rules

1. Copy every partner-supplied case ID into the register without renumbering. Read its preconditions, dependencies and expected results first.
2. Use only the agreed synthetic data and accounts. Keep our CPMS case plan in [uat-cases.md](uat-cases.md) separate: it is what StudyTrack runs on CPMS, not the StudyTrack cases we execute.
3. Both members execute identifiable cases or steps. Record the actual tester, time in ICT, tested version and evidence for each execution; do not allocate a name merely to imply participation.
4. Record actual results per step, including unexpected behavior. PASS requires all expected results to be met. FAIL is an observed mismatch; triage determines whether it is a defect. BLOCKED means a prerequisite prevents execution, with a reason. An unexecuted case has no PASS/FAIL/BLOCKED outcome yet.
5. Capture evidence for every outcome, including a normal journey and a negative/access case. For a rejected operation, inspect the affected record/list and any protected data to demonstrate that nothing was changed or revealed. A red error banner alone is insufficient.
6. If a finding occurs, link a reproducible report using [the finding template](finding-report-template.md), then send it through the agreed channel. Do not access unrelated accounts or data or run load/security/destructive probes outside the supplied cases.
7. Stop and coordinate on an unexpected deployment. Keep prior results tied to their original version; create a new execution record for a retest rather than overwriting a failure.

## 3. Case register

No case rows have been entered because the partner cases are not available. Add actual IDs after receipt; do not submit placeholder rows as completed evidence.

| Partner case ID / title | Requirement / category | Tester | Execution ID / ICT time | Tested version | Outcome | Evidence | Finding / reason |
| --- | --- | --- | --- | --- | --- | --- | --- |

### Per-execution record template

Copy this section once per actual attempt and replace the instructions. Retain initial failures and retests as distinct records.

- Execution ID: `<partner-case-id>-<attempt>`
- Partner case source/revision and requirement:
- Tester name, GitHub username and team:
- Started / finished (date, time and UTC+07:00):
- Product URL, tag/full commit, revision and version-verification evidence:
- Browser/version:
- Account label/role (no password or session token):
- Preconditions and synthetic inputs actually used:

| Step | Action / actual input | Expected result from partner case | Observed result | Evidence ID / link |
| --- | --- | --- | --- | --- |

- Outcome: `<PASS / FAIL / BLOCKED, only after an attempt>`
- Negative/access check: `<what was rejected; what record/data was inspected afterwards>`
- Finding link or blocking reason:
- Retest relationship, if any: `<prior execution ID and finding; otherwise not applicable>`

Evidence IDs should be unique (for example `ST-UAT-<case>-<attempt>-<step>`). Put approved, masked images under `artifacts/lab06/uat/` only when captured. Exclude passwords, tokens, cookies, connection strings, private messages and unrelated personal data.

## 4. Delivery and completion

| Event | Date/time (ICT) | Sender / recipient | Version / cases | Public or redacted acknowledgement reference |
| --- | --- | --- | --- | --- |

This table has no delivery entries yet. Record the partner's receipt of the actual results; a prepared draft is not a delivered report.

- [ ] Partner handoff and all required prerequisites confirmed.
- [ ] Every supplied case has a recorded actual outcome and evidence.
- [ ] Both CPMS members have traceable execution contributions.
- [ ] Normal and negative/access evidence includes persistence/no unauthorized change checks as applicable.
- [ ] Findings linked to [findings.md](findings.md), including BLOCKED cases requiring follow-up.
- [ ] Results sent to StudyTrack and delivery acknowledgement recorded.
- [ ] Teammate review completed before Issue #61 is marked complete.

Final product acceptance belongs to the independent UAT team testing that product. Our CPMS acceptance is recorded from StudyTrack's decision, not inferred from our outgoing test register or CI.
