# Partner UAT execution register (Lab 6 Part B)

Related Issue: [#61](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/61). Testers: Nuggetkub (A) and Earth2509 (B); reviewer of this register: Earth2509.

## Current execution status

First run completed 19 November 2026 (ICT), with view-only rechecks on 20 November 2026. **All four StudyTrack cases (ST-UAT-01 to ST-UAT-04) were executed: 4 PASS, 0 FAIL, 0 BLOCKED. No findings were raised.** Results were delivered to StudyTrack on 20 November 2026 and acknowledged the same day; see section 4.

**Part D exercise (21–22 November 2026):** we tested StudyTrack's controlled-defect build blind (54/55 steps PASS, one FAIL reported as [studytrack#73](https://github.com/auto4496/studytrack/issues/73)), then retested their fix on 22 November: **all four checks PASS**. **Our final Sprint 1 decision for StudyTrack `ef0de7f`: Accepted with one documented minor limitation (F1-3).** See section 5.

Partner: [StudyTrack](https://github.com/auto4496/studytrack), Theme 8; auto4496 and Datakung. Scope agreed with the partner: F-01 to F-04 only. Controls for F-05 (goal management), F-06 (edit time / history) and F-07 (reading schedule) appear on the same pages and were not used.

## 1. Handoff and session prerequisites

| Required item | Status / value | Source or confirmation |
| --- | --- | --- |
| Partner case document and immutable version/link | Received: [`uat-cases.md` @ `200db98`](https://github.com/auto4496/studytrack/blob/200db98bc942743afbc580efdd2f5a8d6fa69566/docs/labs/lab06/uat-cases.md) (identical at staging merge `8b03af2`) | auto4496, Issue [#59](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/59) coordination |
| Accepted Sprint 1 scope and contract/AC links | F-01 to F-04, as listed in the case document | Case document; auto4496 |
| Exact tested tag/full commit and deployment revision | Tag `uat-lab6-2026-11-18` = `ef0de7f877dcabe8ec330eb2c0029d9cebf8ed40`; [Deploy demo run 44090861325](https://github.com/auto4496/studytrack/actions/runs/44090861325); Cloud Run revision `studytrack-gef0de7f877dc-r44090861325-1` | auto4496 |
| Live URL and a way to verify the running version | `https://studytrack-981693883236.asia-southeast1.run.app`; Cloud Run revision/traffic screenshot from StudyTrack (evidence `ST-UAT-00-version`, cropped) showing the revision above at **100%** traffic and every older revision at 0% | Received 19 Nov 21:44 ICT; the image does not show its capture time. It confirms the traffic split at that moment only. **Session-start verification was not done for any run**, so serving during the run windows (19 Nov 11:19–22:40, 20 Nov 11:28–11:40) was first only inferred: traffic can move between existing revisions without a new deployment. We requested confirmation on 20 Nov 2026. **Confirmed 20 Nov 2026** by StudyTrack's Cloud Run admin activity evidence, [StudyTrack PR #71](https://github.com/auto4496/studytrack/pull/71) (merged `ff459b4`), reviewed by Datakung. The last Cloud Run change, a `ReplaceService` on 17 Nov 13:21:12Z (20:21:12 ICT), set this revision to 100% traffic. A query from just after that entry to 20 Nov 05:00Z (12:00 ICT) returns 0 results, so there were no deploys or traffic changes during either window. Supporting public check: `main` = `ef0de7f`, last deploy run 44090861325 (17 Nov 13:15 UTC). |
| Account labels, roles and ownership boundaries | MGR `manager@studytrack.test` (Program Manager); P1 `student1@studytrack.test` and P2 `student2@studytrack.test` (นักศึกษา). StudyTrack keeps one sign-in per browser. | Case document |
| Credentials delivered through the agreed private channel | Received by private DM; values not recorded | auto4496 |
| Synthetic inputs, fixtures, timezone and setup/cleanup rules | Synthetic titles from the case document; date D = actual run date **2026-11-19** (ICT) instead of the planned 18 Nov | Case document; plan variation below |
| First-run session, correction window and independent retest session (ICT) | Planned 18 Nov 20:00–22:00; actually run 19 Nov (11:19–22:40) with rechecks 20 Nov 11:28–11:40. Retest/decision session 22 Nov 13:00–15:00. | Issue #59 |
| Both CPMS testers' allocation / attendance | A = Nuggetkub: ST-UAT-01, ST-UAT-03. B = Earth2509: ST-UAT-02, ST-UAT-04. | Execution records below |

**Plan variation.** The run moved from 18 to 19 November, so D = 2026-11-19 everywhere. The T1 title keeps the suffix `R1-20261118-A` because it was typed before the move; it is only an identifier.

## 2. Execution rules

1. Copy every partner-supplied case ID into the register without renumbering. Read its preconditions, dependencies and expected results first.
2. Use only the agreed synthetic data and accounts. Keep our CPMS case plan in [uat-cases.md](uat-cases.md) separate: it is what StudyTrack runs on CPMS, not the StudyTrack cases we execute.
3. Both members execute identifiable cases or steps. Record the actual tester, time in ICT, tested version and evidence for each execution; do not allocate a name merely to imply participation.
4. Record actual results per step, including unexpected behavior. PASS requires all expected results to be met. FAIL is an observed mismatch; triage determines whether it is a defect. BLOCKED means a prerequisite prevents execution, with a reason. An unexecuted case has no PASS/FAIL/BLOCKED outcome yet.
5. Capture evidence for every outcome, including a normal journey and a negative/access case. For a rejected operation, inspect the affected record/list and any protected data to demonstrate that nothing was changed or revealed. A red error banner alone is insufficient.
6. If a finding occurs, link a reproducible report using [the finding template](finding-report-template.md), then send it through the agreed channel. Do not access unrelated accounts or data or run load/security/destructive probes outside the supplied cases.
7. Stop and coordinate on an unexpected deployment. Keep prior results tied to their original version; create a new execution record for a retest rather than overwriting a failure.

## 3. Case register

"Tested version" below is the agreed release (`ef0de7f`, revision `studytrack-gef0de7f877dc-r44090861325-1`). The outcomes are what we observed in the live app; StudyTrack's audit-log evidence confirms this revision served 100% of traffic during every run (section 1).

| Partner case ID / title | Requirement / category | Tester | Execution ID / ICT time | Tested version | Outcome | Evidence | Finding / reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ST-UAT-01 normal journey | F-01–F-04 / normal | Nuggetkub (A) | ST-UAT-01-1 / 19 Nov 11:19–11:58 | `ef0de7f` | PASS (7/7) | `ST-UAT-01-A-s1`…`s7` | None |
| ST-UAT-02 boundary | F-02–F-04 / boundary, negative | Earth2509 (B) | ST-UAT-02-1 / 19 Nov 20:49–20:51 | `ef0de7f` | PASS (6/6) | `ST-UAT-02-B-r1-s0`…`s5` (no address bar) | None |
| ST-UAT-02 boundary | F-02–F-04 / boundary, negative | Earth2509 (B) | ST-UAT-02-2 / 19 Nov 22:35–22:40 | `ef0de7f` | PASS (6/6) | `ST-UAT-02-B-r2-s0`…`s5` | None |
| ST-UAT-03 privacy and forbidden role | F-02–F-04 / access | Nuggetkub (A) | ST-UAT-03-1 / 19 Nov 19:07–19:15 | `ef0de7f` | PASS (5/5) | `ST-UAT-03-A-s1`…`s5` | None |
| ST-UAT-04 persistence | F-03–F-04 / persistence, access | Earth2509 (B) | ST-UAT-04-1 / 19 Nov 20:52–20:55; evidence recheck 22:26–22:30 | `ef0de7f` | PASS (5/5) | `ST-UAT-04-B-s1`…`s5`; supporting `ST-UAT-04-A-recheck-s4b` | None |

Evidence screenshots are kept by the team for the Lab 6 PDF and are not committed here. Browser address bars are visible except where noted; no passwords, cookies or tokens appear.

Fixtures created by this run (synthetic, left in StudyTrack):
- **T1** `UAT-CPMS-01 Template-R1-20261118-A`.
- **G1** = `/goals/43ff5cd9-6807-466a-abee-330092079b54` (P1, T1, target 60, start 2026-11-19); **E1** = its 45-minute entry for 2026-11-19.
- **T2** `UAT-CPMS-02 Boundary-R1-20261119-B`; **G2** = `/goals/29800ad6-8e3a-4f20-beb4-d7277eaa68cc` (P1, T2, target 30), one 30-minute entry.
- **R2** `UAT-CPMS-02 Boundary-R2-20261119-B`; **G3** = `/goals/d708e38f-1f2c-47e6-a9f1-fe8a9c4104ad` (P1, R2, target 30), one 30-minute entry.

### ST-UAT-01-1

- Partner case: ST-UAT-01 @ `200db98`. Tester: Nuggetkub (67070501046), CPMS. 19 Nov 2026 11:19–11:58 (UTC+07:00). Chrome on Windows. Accounts MGR, P1.

| Step | Action / actual input | Expected result from partner case | Observed result | Evidence ID |
| --- | --- | --- | --- | --- |
| 1 | 11:19 sign in as MGR | Manager catalog | URL `/manager/templates`; heading `Activity Templates`; sidebar `ผู้ดูแลกิจกรรม` / `Program Manager`; `＋ สร้าง Template` | ST-UAT-01-A-s1 |
| 2 | 11:21 create T1, description `Synthetic reading journey for CPMS UAT`, 30–120 | T1 card shows `30–120 นาทีต่อวัน` | T1 card first with the exact title, description and `30–120 นาทีต่อวัน` | ST-UAT-01-A-s2 |
| 3 | 11:26 sign out, sign in as P1, open `/templates` | T1 visible with `ตั้งเป้าหมาย →`; no create button | `กิจกรรมการอ่าน`; user `นักอ่านคนที่หนึ่ง`; T1 card with `ตั้งเป้าหมาย →`; no create-template button or manager menu | ST-UAT-01-A-s3 (retaken 11:38) |
| 4 | 11:29 T1 → target 60, start 19/11/2026 | `/goals/<UUID>`, `Active`, `60 นาที`, `30–120 นาที` | URL G1; `Active`; `60 นาที`; `เริ่มต้น 19 พ.ย. 2569`; `30–120 นาที` | ST-UAT-01-A-s4 |
| 5 | 11:34 select D | `0 / 60 นาที`, `0%`, `ยังไม่มีบันทึกสำหรับวันที่เลือก` | As expected, with entry field and `บันทึกเวลา →` | ST-UAT-01-A-s5 |
| 6 | 11:35 enter 45, submit once | Saved; `45 / 60 นาที`, `75%`, `ยังไม่ครบเป้าหมาย` | `บันทึกเวลาอ่านเรียบร้อยแล้ว`; `45 / 60 นาที`; `75%`; `ยังไม่ครบเป้าหมาย`; `บันทึกแล้ว 45 นาทีสำหรับวันที่เลือก`; form replaced by saved state | ST-UAT-01-A-s6 |
| 7 | 11:38 / 11:58 reopen G1 from `/goals` | Same G1, target 60, 45/60/75% | Same URL, title, `Active`, `60 นาที`; 45/60/75% re-shown in ST-UAT-03 step 5 and ST-UAT-04 | ST-UAT-01-A-s7 |

- Outcome: **PASS**. Note: the 11:26 step 3 capture and the 11:38 step 7 capture were overwritten by retakes; the retakes are the evidence.

### ST-UAT-02-1 (attempt 1)

- Tester: Earth2509 (67070501069), CPMS, with OpenAI Codex operating the browser; Earth2509 entered credentials. 19 Nov 2026 20:49–20:51. Accounts MGR, P1. Captures have no address bar, so attempt 2 was run for complete evidence.

| Step | Action / actual input | Expected result | Observed result | Evidence ID |
| --- | --- | --- | --- | --- |
| 0 | 20:49 MGR creates T2, `Synthetic lower-bound check for CPMS UAT`, 30–120 | Card saved | T2 card with exact title, description, `30–120 นาทีต่อวัน` | ST-UAT-02-B-r1-s0 |
| 1 | 20:51:13 P1, T2, target 29, start 19/11/2026 | Browser blocks it (minimum 30); no goal created | `Value must be greater than or equal to 30.`; still on the form with 29 | ST-UAT-02-B-r1-s1 |
| 2 | 20:51:32 target 30 | Goal created: `30 นาที`, `30–120 นาที`, `Active` | G2: `Active`, `30 นาที`, start `19 พ.ย. 2569`, `30–120 นาที` | ST-UAT-02-B-r1-s2 |
| 3 | 20:51:37 entry 29 for D | `ระบุจำนวนเต็ม 30–120 นาที`; `0 / 30 นาที`, `0%` | As expected; `ยังไม่มีบันทึกสำหรับวันที่เลือก` | ST-UAT-02-B-r1-s3 |
| 4 | 20:51:43 entry 30, once | `30 / 30 นาที`, `100%`, `อ่านครบเป้าหมายแล้ว` | As expected, with `บันทึกแล้ว 30 นาทีสำหรับวันที่เลือก` | ST-UAT-02-B-r1-s4 |
| 5 | 20:51:56 refresh G2, select D | Only one 30-minute entry | 30/30, 100%; history `พบ 1 รายการ` | ST-UAT-02-B-r1-s5 |

- Outcome: **PASS**. G2 rechecked by Nuggetkub at 21:27–21:29: its history shows only its own 30/30 entry.

### ST-UAT-02-2 (attempt 2)

- Tester: Earth2509, as above. 19 Nov 2026 22:35–22:40, Opera, address bar visible. New template R2 and goal G3 so that G1 and G2 were not modified.

| Step | Action / actual input | Expected result | Observed result | Evidence ID |
| --- | --- | --- | --- | --- |
| 0 | 22:35 MGR creates R2, same description, 30–120 | Card saved | `/manager/templates`: R2 card with exact title, description, `30–120 นาทีต่อวัน` | ST-UAT-02-B-r2-s0 |
| 1 | 22:39 P1, R2, target 29, start 19/11/2026 | Blocked; no goal created | URL `/goals/new`; `Value must be greater than or equal to 30.`; field still 29 | ST-UAT-02-B-r2-s1 |
| 2 | 22:39 target 30 | Goal created | URL G3; `Active`, `30 นาที`, start `19 พ.ย. 2569`, `30–120 นาที` | ST-UAT-02-B-r2-s2 |
| 3 | 22:40 entry 29 for D | Rejected; `0 / 30`, `0%` | `ระบุจำนวนเต็ม 30–120 นาที`; `0 / 30 นาที`, `0%` | ST-UAT-02-B-r2-s3 |
| 4 | 22:40 entry 30, once | `30 / 30`, `100%` | `บันทึกเวลาอ่านเรียบร้อยแล้ว`; `30 / 30 นาที`; `100%`; `อ่านครบเป้าหมายแล้ว` | ST-UAT-02-B-r2-s4 |
| 5 | 22:40 refresh G3 | One entry only | History `พบ 1 รายการ`, `19 พ.ย. 2569 · 30 / 30 นาที · 100%` | ST-UAT-02-B-r2-s5 |

- Outcome: **PASS**. Negative check: the rejected target left the browser on `/goals/new` (no goal created), the rejected entry left progress at `0 / 30`, and the final history shows exactly one entry.

### ST-UAT-03-1

- Tester: Nuggetkub, CPMS. 19 Nov 2026 19:07–19:15. Chrome. Accounts P2, MGR, P1.

| Step | Action / actual input | Expected result | Observed result | Evidence ID |
| --- | --- | --- | --- | --- |
| 1 | 19:07 P2 opens `/goals` | G1 not listed | `นักอ่านคนที่สอง`; `0 เป้าหมาย`; empty state | ST-UAT-03-A-s1 |
| 2 | 19:08 P2 opens the G1 URL | `ไม่พบรายการที่ต้องการ`; no data | Alert `ไม่พบรายการที่ต้องการ`, `ลองใหม่`; no title, target, entry or progress | ST-UAT-03-A-s2 |
| 3 | 19:11 P2 opens `/goals/00000000-0000-4000-8000-000000000099` | Same response | Identical alert; hidden and missing goals look the same | ST-UAT-03-A-s3 |
| 4 | 19:13 MGR opens the G1 URL | `บัญชีนี้ไม่มีสิทธิ์เปิดหน้านี้`; no data | As expected, with `กลับหน้าหลัก`; no goal data | ST-UAT-03-A-s4 |
| 5 | 19:15 P1 opens G1, selects D | Unchanged `45 / 60`, `75%` | `45 / 60 นาที`, `75%`, `ยังไม่ครบเป้าหมาย`, `บันทึกแล้ว 45 นาทีสำหรับวันที่เลือก` | ST-UAT-03-A-s5 |

- Outcome: **PASS**. Negative/access check: step 5 confirms G1 and E1 were unchanged after the P2 and MGR attempts.

### ST-UAT-04-1

- Tester: Earth2509 (Codex-operated browser, as above), on a different machine from the one that created G1. Steps executed 19 Nov 2026 20:52–20:55; the address-bar evidence set is a read-only recheck in Opera at 22:26–22:30. Account P1.

| Step | Action / actual input | Expected result | Observed result | Evidence ID |
| --- | --- | --- | --- | --- |
| 1 | P1 opens G1, selects D | Title, target 60, `45 / 60`, `75%`, `ยังไม่ครบเป้าหมาย` | G1 URL; `UAT-CPMS-01 Template-R1-20261118-A`, `Active`, `60 นาที`, start `19 พ.ย. 2569`; `45 / 60 นาที`, `75%`, `ยังไม่ครบเป้าหมาย`, `บันทึกแล้ว 45 นาทีสำหรับวันที่เลือก` | ST-UAT-04-B-s1-goal, ST-UAT-04-B-s1 |
| 2 | Refresh | Same values, no sign-in, no second entry form | Same values; still signed in; no entry form | ST-UAT-04-B-s2 |
| 3 | Sign out, type G1 URL | `/login`, no goal data | URL `/login`; empty `อีเมล` / `รหัสผ่าน`; no goal data | ST-UAT-04-B-s3 |
| 4 | Sign in as P1, open G1, select D | Same G1 and 45/60/75% | Same URL, title, `Active`, `60 นาที`, start date; for 19 Nov `45 / 60 นาที`, `75%`, `ยังไม่ครบเป้าหมาย` | ST-UAT-04-B-s4-goal, ST-UAT-04-B-s4 |
| 5 | Refresh | Matches step 1 | History `พบ 1 รายการ`, `19 พ.ย. 2569 · 45 / 60 นาที · 75%` | ST-UAT-04-B-s5 |

- Outcome: **PASS**. `ST-UAT-04-B-s2` (22:27:35) and `ST-UAT-04-B-s4` (22:29:59) are separate captures of an unchanged view: the files are byte-identical, and between them P1 was signed out, the G1 link redirected to `/login` and P1 signed in again (step 3). Supporting recheck by Nuggetkub on 20 Nov 11:40 (Chrome; sign-out redirect, sign in as P1, D = 19/11/2026): `45 / 60 นาที`, `75%`, `ยังไม่ครบเป้าหมาย`, one history entry (`ST-UAT-04-A-recheck-s4b`).

### Out-of-scope controls: confirmation

Nuggetkub checked on 20 Nov (view only): G2's reading-schedule status is `ยังไม่ได้ตั้งตารางอ่าน` (the pre-filled schedule form is the default for the current weekday), and on `/manager/templates` R2, R1 and T1 are all still open. No F-05, F-06 or F-07 action was taken during the run.

## 4. Delivery and completion

| Event | Date/time (ICT) | Sender / recipient | Version / cases | Public or redacted acknowledgement reference |
| --- | --- | --- | --- | --- |
| Results sent to StudyTrack (includes the serving-revision confirmation request) | 20 Nov 2026 (time not recorded) | Nuggetkub → auto4496, Datakung | `ef0de7f`; ST-UAT-01 to 04 | Discord DM (private; contents not published) |
| StudyTrack acknowledged receipt | 20 Nov 2026, by 17:13 | auto4496, Datakung → Nuggetkub, Earth2509 | `ef0de7f`; "four cases passed with no findings" | Public: StudyTrack's [`coordination.md` line 18 @ `ff459b4`](https://github.com/auto4496/studytrack/blob/ff459b40b3f21b28a11693a4c0301539dc559483/docs/labs/lab06/coordination.md#L18) (merged in [StudyTrack PR #71](https://github.com/auto4496/studytrack/pull/71), approved by Datakung): "The user confirmed receipt of CPMS's four PASS results with no findings." The original receipt was a private Discord DM in StudyTrack's "Lab 6 UAT results for CPMS" message (not published; see [findings.md section 2](findings.md#2-findings-received-about-cpms-incoming)). |

- [x] Partner handoff and all required prerequisites confirmed (serving revision during the run windows confirmed 20 Nov 2026, [StudyTrack PR #71](https://github.com/auto4496/studytrack/pull/71) (merged `ff459b4`)).
- [x] Every supplied case has a recorded actual outcome and evidence.
- [x] Both CPMS members have traceable execution contributions.
- [x] Normal and negative/access evidence includes persistence/no unauthorized change checks as applicable.
- [x] Findings linked to [findings.md](findings.md), including BLOCKED cases requiring follow-up (none raised).
- [x] Results sent to StudyTrack and delivery acknowledgement recorded.
- [ ] Teammate review completed before Issue #61 is marked complete.

Final product acceptance belongs to the independent UAT team testing that product. Our CPMS acceptance is recorded from StudyTrack's decision, not inferred from our outgoing test register or CI.

## 5. Part D: blind run of StudyTrack's exercise build, retest and decision

Under the TA's "Clarification for Teams with No UAT Defects", StudyTrack planted one defect on its staging branch and deployed it to a separate service. We tested it **blind**: we did not open their commit, PRs or issues until our report was sent. The detailed per-step log and screenshots are kept by the team for the Lab 6 PDF.

| Item | Value |
| --- | --- |
| Exercise URL | https://studytrack-partd-981693883236.asia-southeast1.run.app |
| Tested build (partner-reported) | `832b8c8372c4d91a75915231edcf68850a45c838`, revision `studytrack-partd-g832b8c8-exercise`. StudyTrack's Cloud Run screenshot showed it at 100% (received 21 Nov 17:04 ICT). Their `/api/health` has no commit field. |
| Window | 21 Nov 2026, 16:49–22:00 ICT. The session-start version check was done after testing began (recorded here as a limitation). |
| Cases | StudyTrack ST-UAT-01 to 04 @ `200db98`, plus five additional cases we wrote and sent to StudyTrack: ST-X01 (login/session), X02 (template limits), X03 (goal limits, duplicates), X04 (progress arithmetic), X05 (access and 390×844 layout). Fixture suffix `PD-20261121-A`. |
| Testers | A = Nuggetkub (Chrome), B = Earth2509 (Opera; some steps Codex-operated, credentials typed by Earth2509) |

| Case | Tester | Steps | PASS | FAIL | BLOCKED |
| --- | --- | --- | --- | --- | --- |
| ST-UAT-01 | A | 7 | 7 | 0 | 0 |
| ST-UAT-02 | B | 5 | 5 | 0 | 0 |
| ST-UAT-03 | A | 5 | 5 | 0 | 0 |
| ST-UAT-04 | A | 5 | 5 | 0 | 0 |
| ST-X01 | A | 5 | 5 | 0 | 0 |
| ST-X02 | B | 8 | 8 | 0 | 0 |
| ST-X03 | B | 8 | 8 | 0 | 0 |
| ST-X04 | B | 7 | 7 | 0 | 0 |
| ST-X05 | A | 5 | 4 | **1** | 0 |

**54/55 steps PASS.** ST-X05 step 3 (21 Nov 21:46, 390×844): a valid 100-character goal title with no spaces runs past the right edge of the goal page. Reported as F1, [studytrack#73](https://github.com/auto4496/studytrack/issues/73) (see [findings.md section 1](findings.md#1-reporting-a-finding-in-studytrack-outgoing)).

### Independent retest of StudyTrack's fix (22 Nov 2026)

StudyTrack fixed F1 in [StudyTrack PR #74](https://github.com/auto4496/studytrack/pull/74) and handed over `1aae2decccd00cb278a4e1adcd6abcb24843ebdb`, revision `studytrack-partd-g1aae2de-fix` (Datakung on #73, 12:54 ICT). Tester: Nuggetkub, Chrome DevTools device mode at 100%, existing fixtures (P1, G3, the 100/500-character template). Overflow check in the Console: `[document.documentElement.scrollWidth, innerWidth, document.documentElement.scrollWidth <= innerWidth]`.

| Check | Viewport | Time (ICT) | Observed | Console | Result |
| --- | --- | --- | --- | --- | --- |
| F1-1 goal page G3 | 390×844 | 15:05 (retake; the 14:51 capture was scrolled past the title) | Full title wraps over 6 lines inside the screen; last `X` visible; `Active` on its own line | `[390, 390, true]` | PASS |
| F1-2 goal page G3 | 1440×900 | 14:55 | Title wraps over 3 lines; `Active` clear, no overlap | `[1440, 1440, true]` | PASS |
| F1-3 `/goals/new`, template selected | 1440×900 | 14:58 | 500-character description wraps inside the form card | `[1440, 1440, true]` | PASS |
| F1-3 `/goals/new`, template selected | 390×844 | 15:01 | Description wraps inside the card | `[390, 390, true]` | PASS |

Nothing was submitted on `/goals/new`. Results and screenshots are posted on [#73](https://github.com/auto4496/studytrack/issues/73#issuecomment-7076330686). Datakung corroborated the serving revision on #73 (19:37 ICT): `ReplaceService` at 12:51:04 ICT, no later service change, and all 55 logged requests from 14:50:33 to 15:06:29 ICT served by `studytrack-partd-g1aae2de-fix`.

### Our final Sprint 1 UAT decision for StudyTrack

**Accepted with one documented minor limitation.** UAT Team: Nuggetkub and Earth2509, 22 November 2026. Release: tag `uat-lab6-2026-11-18` = `ef0de7f877dcabe8ec330eb2c0029d9cebf8ed40`, revision `studytrack-gef0de7f877dc-r44090861325-1`.

- Basis: ST-UAT-01 to 04 PASS on `ef0de7f` (section 3); Part D run 54/55, with the one FAIL fixed and retested PASS on `1aae2de`.
- Limitation **F1-3** (Minor, layout only, no data loss): a long unbroken template description doesn't wrap on `/goals/new`. StudyTrack confirmed that F1-3 applies to `ef0de7f` and asked us to keep this decision (Datakung on [#70](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/70#issuecomment-7079679438), 22 Nov 20:15 ICT). Fixed and independently retested on the separate Part D release `1aae2de`; not released to StudyTrack `main`.
