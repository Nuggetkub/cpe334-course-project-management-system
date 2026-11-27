# Three-sprint delivery plan

Version 0.7 · 2026-11-27 · F-11 phase 2 done (#111). (v0.6: 2026-11-27, `staging/sprint-3` created; D-09 done (#109).) (v0.5: 2026-11-26, D2 (#87): `v0.6.0` (`6464f87`) released on `main` and verified; F-11 phase 1 released.) (v0.4: 2026-11-26, `v0.5.0` released and accepted; F-11 phase 1 integrated; remaining work updated.) (v0.3: 2026-11-25, actual Sprint 2/3 ownership, release path (DEC-15) and the remaining-work plan to 13 December.) (v0.2: 2026-11-04, D1 Part D, Issue #4, PR #30 review.)

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
| 2 | **Confirmed:** @Earth2509 owns F-07 and F-10; @Nuggetkub owns F-08 and F-09. Each reviews the other's PRs. | D2 — 29 Nov 2026 |
| 3 | **Confirmed:** @Nuggetkub owns F-11 (moved from @Earth2509 to balance D2, #84) and F-12; @Earth2509 owns F-13. | Progress at D2 — 29 Nov 2026; complete by 13 Dec 2026 |

If D1 runs short, prioritize the tested path on `main`: sign in with the correct role, enforce cross-team denial, view the team, create/view a milestone, persist a submission within its deadline and record/read version-linked feedback (AC-03.3/03.6, AC-04.1/04.3, AC-05.1/05.3/05.5, AC-06.1/06.3/06.4). Do not waive authorization or persistence checks; report any unfinished acceptance criteria rather than declaring Sprint 1 complete.

## Evidence and release gates

For each feature, record the contract, test cases, implementation evidence and peer review. Integrate feature PRs into the matching `staging/sprint-N` branch, run the applicable regression suite and record reviewer/UAT findings, then release to `main` through a reviewed PR and tag per [DEC-11](../decisions.md). Distinguish work integrated to staging from work released on main. Update issue/project status only when its actual gate has been reached.

**Release path for D2 (DEC-15):** Sprint 2 is released from `staging/sprint-2` as `v0.5.0`. F-11 phase 1 then goes into `staging/sprint-2` and is released as the D2 candidate `v0.6.0`. After that, `staging/sprint-3` is created for the rest of Sprint 3. It was created on 27 Nov from `staging/sprint-2` `3e17c25`, not from `main`: that commit is `main` plus the reviewed D2 documents (#108), with the same code as `v0.6.0` ([#87 comment](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/87#issuecomment-7211467410)).

## Remaining work to 13 December

Status date: 27 Nov 2026, `main` `6464f87` (`v0.6.0`), `staging/sprint-3` `8bb3f3c` (after #111). Exams run 1–11 Dec, so the product work is front-loaded: Sprint 2 ships before D2, and the remaining Sprint 3 features finish in the first days of December, leaving the last days for verification, UAT re-tests, the video and the release. **The target dates are a proposal for @Earth2509 to confirm in review.**

| Feature or defect | Current status | Remaining action | Owner and target |
| --- | --- | --- | --- |
| F-10 grades (#83) | **Done**: server #98, Grade UI and v0.5 release rule #101; released in `v0.5.0` | None | @Nuggetkub (UI); review @Earth2509; done 25 Nov |
| R-01 single-course preflight | **Done** 25 Nov: live count is 1 | None | @Nuggetkub; done |
| D-10 TEST-02.1 registry | **Done**: F-08/F-09 (#100), F-11 (`c24db4b` in #94) | None | @Nuggetkub; done 26 Nov |
| `v0.5.0` Sprint 2 release (#87) | **Done** 26 Nov: #103 → `2fde19e`, revision `cpms-00009-2jg`; deployed checks 13/13 PASS ([#87](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/87#issuecomment-7192705886)); synced back (#104) | None | @Nuggetkub (PR, checks), @Earth2509 (review, merge); done 26 Nov |
| F-11 phase 1 (#84, PR #94) | **Done** 26 Nov: released in `v0.6.0`, deployed checks D6 7/7 PASS | None; #84 stays open for phase 2 | @Nuggetkub; review @Earth2509; done |
| `v0.6.0` D2 candidate | **Done** 26 Nov: #106 → `6464f87`, revision `cpms-00010-6vv`, tag `v0.6.0`; sync back (#107) | None: `staging/sprint-3` created 27 Nov from `3e17c25` | @Nuggetkub; review @Earth2509; done 27 Nov |
| D2 PDF | Documents current; demos captured on `v0.5.0` (D5) and `v0.6.0` (D6) | Build the PDF, teammate review, submit on LEB2 | @Nuggetkub; review @Earth2509; 29 Nov |
| D-11 flaky sign-in wait (TEST-05.1e) | **Done** 25 Nov (#102); F-10 and F-11 specs switched (#101, #94) | None | @Nuggetkub; done |
| D-14 Manage milestone panel layout (Minor) | Open (found in D5-04/D5-05) | Stack labels above fields; client layout check; deployed re-check | @Nuggetkub; review @Earth2509; 3 Dec |
| D-09 CI secret scan (NFR-12) | **Done** 27 Nov: #109 → `1544ca0` (integrated); seeded fake secrets fail the scan | Reaches `main` in `v1.0.0` | @Nuggetkub; review @Earth2509; done 27 Nov |
| F-11 phase 2, AC-11.3 | **Done** 27 Nov: #111 → `8bb3f3c` (integrated; R-111) | Deployed check with `v1.0.0` | @Nuggetkub; review @Earth2509; done 27 Nov |
| F-12 overview and filters (#85) | Contract approved (#93) | Tests first, implementation, review, through `staging/sprint-3` | @Nuggetkub; 2 Dec |
| F-13 CSV export (#86) | Contract v0.2 approved (#97) | Tests first, implementation on top of F-12 and `studentGrade`, review | @Earth2509; 5 Dec |
| NFR-09 performance (AC-12.4) | Not measured | Scaled seed on Cloud Run; TEST-12.4p report with method, revision and date | @Nuggetkub; 6 Dec |
| SR-01 audit (NFR-10), NFR-08 walkthrough | Planned | E2E audit of every form and list; timed fresh-clone walkthrough by the teammate | @Earth2509; 7 Dec |
| UAT re-tests | Sprint 1 accepted (`v0.3.0`) | Agree re-test cases for the Sprint 2/3 journeys with the UAT partner; record results and decisions | Both; 8–9 Dec |
| Final release `v1.0.0` | — | Release PR from `staging/sprint-3`, regression, tag, deploy, deployed checks | @Nuggetkub; review @Earth2509; 10 Dec |
| Final video and submission | — | Record the demo video (length per the open question in SRS §8), final PDF | Both; 12 Dec (deadline 13 Dec) |

Every item keeps the same gates as before: contract before tests, tests before code (RED then GREEN), teammate review, CI, staging, a reviewed release and a deployed check. A Sprint 2 feature is never moved to Sprint 3 to make the sprint look complete; if F-10 slips past D2, D2 reports Sprint 2 as incomplete.
