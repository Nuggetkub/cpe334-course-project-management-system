# UAT finding report template

Use for an actual observed failure, not a hypothetical bug. Copy into the relevant product's issue tracker or agreed report channel. Replace placeholders and remove instructional text before delivery. Track it in [findings.md](findings.md).

## Summary

- Finding ID / concise title:
- Product / repository:
- Reporter name, GitHub username and team:
- Observed date/time (ICT, UTC+07:00):
- Partner case ID / step and execution record:
- Tested tag/full commit, deployment revision and live URL:
- How the running version was confirmed / evidence:
- Requirement / acceptance criterion and immutable contract link:
- Proposed severity and concrete user impact:
- Classification: suspected defect pending Product Team triage, or enhancement request if outside scope.

## Preconditions and synthetic data

- Browser/version and relevant environment:
- Account label, role and team/ownership (no credentials):
- Setup, existing state and exact synthetic inputs:
- Relevant timezone/deadline and server/client times if applicable:

## Reproduction

1. `<action>`
2. `<action>`
3. `<action>`

**Expected result:** `<observable behavior required by the cited criterion>`

**Actual result:** `<what was seen, including exact safe message/status and persistence or disclosure observed>`

**Frequency / attempts:** `<actual count; do not claim always from one attempt>`

**After rejection / reload:** `<record inspected; whether data changed or was exposed; evidence reference>`

**Workaround:** `<verified workaround, none found, or not investigated>`

## Evidence

| Evidence ID / link | Captured (ICT) | Case step / record | What it demonstrates |
| --- | --- | --- | --- |

Mask passwords, tokens, cookies, connection strings and unrelated personal information. Include the public URL and relevant UI/API response where safe; preserve the unmodified original through the agreed private evidence process, not in this public report.

## Product Team response and independent retest

- Classification / contract-based reason / duplicate link if applicable:
- Confirmed severity, owner and bug Issue:
- RED reproduction, fix PR, GREEN/regression evidence:
- Release commit/revision and deployment/smoke evidence:
- Independent retester name/team, retest date/version and case results:
- Final disposition / acknowledged limitations:

Leave response/retest fields pending until the responsible person provides them. A reporter must not invent another team's acceptance decision.
