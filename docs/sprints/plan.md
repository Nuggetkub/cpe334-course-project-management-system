# Three-sprint delivery plan

Version 0.1 · 2026-11-04 · D1 Part D · Issue #4

Scope follows the [feature catalogue](../features.md), [SRS](../srs.md) and [traceability matrix](../traceability.md). Completion outcomes are acceptance targets, not delivery claims.

| Sprint | Goal and feature IDs | Dependencies and sequencing | Completion outcome |
| --- | --- | --- | --- |
| 1 | Deliver the first complete supervised coursework flow. **F-01** auth; **F-02** authorization; **F-03** data/seed and team views; **F-04** milestone create/view; **F-05** submit/view; **F-06** version-linked feedback. | Scaffold #5 → F-03.1 → integrated F-01 → F-02. After F-02, F-03.2 and F-04 can proceed separately; F-04 → F-05 → F-06. | Seeded roles sign in, see only permitted teams, and complete create milestone → submit once → record/read feedback. Verify boundary and cross-team denial tests, plus loading/empty/error states. |
| 2 | Manage teams and coursework beyond the initial submission. **F-07** team management; **F-08** milestone lifecycle; **F-09** versioned resubmission; **F-10** grades/release. | F-07 needs F-02/F-03.2; F-08 needs F-04; F-09 needs F-05/F-06/F-08; F-10 needs F-02/F-04. Coordinate Lab 5 deployment work with this sprint. | Supervisors manage assigned teams and milestone windows; revisions preserve prior submissions and feedback; students see grades only after release. Verify release and deployment separately. |
| 3 | Make course progress visible and exportable. **F-11** student board; **F-12** supervisor overview/filters; **F-13** CSV export. | F-11 and F-12 need F-06/F-09/F-10; F-13 depends on F-12 and must reuse its authorization scope. | Students see their team's progress and released grades; supervisors filter and export only their assigned teams. Verify CSV/filter parity, UI state consistency and documented performance targets. |

## Why Sprint 1 stops at the first feedback

The sprint proves the full Student–Supervisor interaction with the smallest useful workflow. F-03.1 seeds team and supervision relationships rather than providing administration screens; F-03.2 exposes them after F-02, avoiding a dependency cycle. F-04 provides milestone creation and visibility, F-05 accepts one submission per team/milestone through the server-enforced deadline, and F-06 returns feedback tied to that submission version. Team editing, late windows, revisions, grades and reporting are deferred so the team can verify identity, ownership and persistence first.

## Evidence and release gates

For each feature, record the contract, test cases, implementation evidence and peer review. Integrate feature PRs into the matching `staging/sprint-N` branch, run the applicable regression suite and record reviewer/UAT findings, then release to `main` through a reviewed PR and tag per [DEC-11](../decisions.md). Distinguish work integrated to staging from work released on main. Update issue/project status only when its actual gate has been reached.
