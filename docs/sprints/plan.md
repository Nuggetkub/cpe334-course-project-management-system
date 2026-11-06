# Three-sprint delivery plan

Version 0.2 · 2026-11-04 · D1 Part D · Issue #4 (PR #30 review)

Scope follows the [feature catalogue](../features.md), [SRS](../srs.md) and [traceability matrix](../traceability.md). Completion outcomes are acceptance targets, not delivery claims.

| Sprint | Goal and feature IDs | Dependencies and sequencing | Completion outcome |
| --- | --- | --- | --- |
| 1 | Deliver the first complete supervised coursework flow. **F-01** auth; **F-02** authorization; **F-03** data/seed and team views; **F-04** milestone create/view; **F-05** submit/view; **F-06** version-linked feedback. | Scaffold #5 → F-03.1 → integrated F-01 → F-02. After F-02, F-03.2 and F-04 can proceed separately; F-04 → F-05 → F-06. | Seeded roles sign in, see only permitted teams, and complete create milestone → submit once → record/read feedback. Verify boundary and cross-team denial tests, plus loading/empty/error states. |
| 2 | Manage teams and coursework beyond the initial submission. **F-07** team management; **F-08** milestone lifecycle; **F-09** versioned resubmission; **F-10** grades/release. | F-07 needs F-02/F-03.2; F-08 needs F-04; F-09 needs F-05/F-06/F-08; F-10 needs F-02/F-04. Coordinate Lab 5 deployment work with this sprint. | Supervisors manage assigned teams and milestone windows; revisions preserve prior submissions and feedback; students see grades only after release. Verify release and deployment separately. |
| 3 | Make course progress visible and exportable. **F-11** student board; **F-12** supervisor overview/filters; **F-13** CSV export. | F-11 and F-12 need F-06/F-09/F-10; F-13 depends on F-12 and must reuse its authorization scope. | Students see their team's progress and released grades; supervisors filter and export only their assigned teams. Verify CSV/filter parity, UI state consistency and documented performance targets. |

## Why Sprint 1 stops at the first feedback

The sprint proves the full Student–Supervisor interaction with the smallest useful workflow. F-03.1 seeds team and supervision relationships rather than providing administration screens; F-03.2 exposes them after F-02, avoiding a dependency cycle. F-04 provides milestone creation and visibility, F-05 accepts one submission per team/milestone through the server-enforced deadline, and F-06 returns feedback tied to that submission version. Team editing, late windows, revisions, grades and reporting are deferred so the team can verify identity, ownership and persistence first.

## Allocation and checkpoints

| Sprint | Feature ownership | Checkpoint |
| --- | --- | --- |
| 1 | @Nuggetkub: F-01, F-05. @Earth2509: F-03 (both increments), F-04, F-06. Pair: F-02. | D1 — 8 Nov 2026 |
| 2 | Proposed: @Earth2509 owns F-07, F-10; @Nuggetkub owns F-08, F-09. Confirm at Sprint 2 planning. | D2 — 29 Nov 2026 |
| 3 | Proposed: @Earth2509 owns F-11, F-13; @Nuggetkub owns F-12. Confirm at Sprint 3 planning. | Progress at D2 — 29 Nov 2026; complete by 13 Dec 2026 |

If D1 runs short, prioritize the tested path on `main`: sign in with the correct role, enforce cross-team denial, view the team, create/view a milestone, persist a submission within its deadline and record/read version-linked feedback (AC-03.3/03.6, AC-04.1/04.3, AC-05.1/05.3/05.5, AC-06.1/06.3/06.4). Do not waive authorization or persistence checks; report any unfinished acceptance criteria rather than declaring Sprint 1 complete.

## Evidence and release gates

For each feature, record the contract, test cases, implementation evidence and peer review. Integrate feature PRs into the matching `staging/sprint-N` branch, run the applicable regression suite and record reviewer/UAT findings, then release to `main` through a reviewed PR and tag per [DEC-11](../decisions.md). Distinguish work integrated to staging from work released on main. Update issue/project status only when its actual gate has been reached.
