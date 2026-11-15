# CPMS Sprint 1 UAT plan and handoff (Lab 6, Part A)

Product Team: Section 6, "ไม่ไหวแล้วพี่จ๋า": 67070501046 นายสิทธิเจตน์ จันทรเตมีย์ (@Nuggetkub), 67070501069 นายภัทรภณ กิจจานุกิจ (@Earth2509)
UAT Team: StudyTrack (Theme 8, https://github.com/auto4496/studytrack): 67070501070 นายภาณุวิชญ์ บุตรชารี (@auto4496), 67070501068 นายพิชญ์ชัย ชัดช่วงโชติ (@Datakung)

## 1. Handoff

| Item | Value |
| --- | --- |
| Application | Course Project Management System (CPMS), Theme 6 |
| URL | https://cpms-2ww7lkzxja-as.a.run.app |
| Release under test | Tag `v0.3.0`, commit `b6cffa1d5da7ab33f2af27e6c34e75f20cfc5b9c`, Cloud Run revision `cpms-00007-7r8` |
| Check the version yourself | Open https://cpms-2ww7lkzxja-as.a.run.app/api/health. `commit` must be `b6cffa1d5da7ab33f2af27e6c34e75f20cfc5b9c`. If it differs, stop and tell us. |
| Scope accepted for test | Sprint 1, F-01 to F-06: sign in and sign out, role and team permissions, team views, milestones, one submission per team, supervisor feedback. The acceptance criteria are in `docs/sprints/sprint-1/F-0*.md`. |
| Not in scope | Anything not listed above, for example resubmission, editing or deleting, grading, notifications, admin or course management (Sprint 2 and 3). The Home page placeholder ("Coming in a later Sprint 1 feature.") is not a defect. |
| Browser | Current Chrome, Edge or Firefox on a desktop. The sign-in is kept per browser tab, so each tab can hold a different account. |
| Time zone | All times are shown and entered in Asia/Bangkok (ICT). |
| Change notice | We will not deploy during your test session. If we must deploy, we tell you first, with the new commit. |
| Contact | Discord (shared group between both teams) |

### Accounts (passwords are sent privately, never in the PDF)

| Label | Email | Role | Team |
| --- | --- | --- | --- |
| SUP-A | supervisor1@example.test | Supervisor | Demo Team A |
| SUP-B | supervisor2@example.test | Supervisor | Demo Team B |
| STU-A1 | student1@example.test | Student | Demo Team A |
| STU-A2 | student2@example.test | Student | Demo Team A |
| STU-B1 | student3@example.test | Student | Demo Team B |
| STU-B2 | student4@example.test | Student | Demo Team B (spare) |

All Students share one password and both Supervisors share another. We send these two passwords privately.

### Data setup and cleanup
- The database already has data from our earlier checks (for example the milestones "C-04 cloud check" and "C-05 rollback check" in Team A). Leave them alone and do not use them as test data.
- **Every title you create starts with `UAT-ST-<case ID>`**, for example `UAT-ST-03`. This keeps your data separate and makes each run repeatable.
- Sprint 1 has no delete function, so nothing needs cleaning up. Records you create stay as test evidence. To run a case again, create a new milestone with a new suffix (`-r2`).
- Run the cases in order 01 → 07. Cases 04 and 05 reuse the milestone created in case 01; the others are independent.

## 2. Cases

Each case lists the acceptance criteria it covers. Record what you actually see, not what is expected.

### UAT-01: Normal journey: milestone → submission → feedback
- **Category:** normal domain journey
- **Covers:** AC-01.7, AC-04.1, AC-04.3, AC-05.1, AC-05.5, AC-06.1, AC-06.3
- **Roles:** SUP-A, STU-A1, STU-A2
- **Preconditions:** none.
- **Inputs:**
  - Milestone title `UAT-ST-01 Proposal`; description `Synthetic UAT milestone`; due date tomorrow at 18:00.
  - Submission title `Team A proposal`; link `https://example.com/uat-01`.
  - Feedback `Good start. Add a timeline.`

**Steps and expected results:**
1. Sign in as SUP-A. → The header shows "Demo Supervisor 1", the role and **Log out**. The navigation shows *My teams* and *Milestones*.
2. Open **Milestones**, select **Demo Team A**, fill in the inputs above, then select **Create milestone**. → "Milestone created." appears, and the milestone is in the list with the due time you entered (ICT), "Window: Open" and "Team status: Not submitted".
3. Log out. Sign in as STU-A1, open **Milestones**, then open `UAT-ST-01 Proposal`. → "Not submitted yet" and the **Submit work** form are shown.
4. Enter the submission title and link, then select **Submit**. → The submission appears with your title, link, submitter "Demo Student 1" and a time. The status changes to "Team status: Submitted". **Write down the page URL** (`/milestones/<id>`); cases 04 and 05 need it.
5. Log out. Sign in as SUP-A and open the same milestone. → The same submission is shown, and the **Feedback** section says "No feedback yet".
6. Enter the feedback text and select **Add feedback**. → "Feedback added." appears. The entry shows author "Demo Supervisor 1", a time (ICT) and the submission version.
7. Log out. Sign in as STU-A2 (the other member of Team A) and open the milestone. → The same submission and the feedback entry are shown. STU-A2 has no feedback form.

### UAT-02: Business rule: the deadline
- **Category:** business rule / boundary
- **Covers:** AC-04.2, AC-04.4, AC-05.3, AC-05.8 (BR-05, BR-06)
- **Roles:** SUP-A, STU-A1
- **Inputs:** milestone `UAT-ST-02 Deadline`, first with a due time 1 hour in the past, then with a due time **3 minutes** from now.

**Steps and expected results:**
1. As SUP-A, try to create the milestone with a due time 1 hour in the past. → "Enter a valid future due date and time." appears under the date, and no milestone is created (it is not in the list).
2. Change the due time to 3 minutes from now and create it. → It is created with "Window: Open".
3. In another tab, sign in as STU-A1 and open it **before** the due time. → The **Submit work** form is shown. Do not submit.
4. Wait until at least 1 minute after the due time, then reload the page. → "Window: Closed", "Team status: Overdue", "Not submitted yet" and "The deadline has passed." are shown, and there is no submit form.
5. In the **Milestones** list, as STU-A1 and as SUP-A. → The milestone shows "Overdue".

*Optional:* keep a tab open at step 3, fill in the form, and select **Submit** after the deadline. → The message "The deadline for this milestone has passed." appears, and after a reload there is still no submission.

### UAT-03: Input validation limits
- **Category:** business rule / boundary
- **Covers:** AC-05.2, AC-06.2, AC-01.8
- **Roles:** SUP-A, STU-A1
- **Preconditions:** SUP-A creates `UAT-ST-03 Validation`, due tomorrow at 18:00. Keep it unsubmitted until step 4.

**Steps and expected results:**
1. Signed out, on the Sign in page, select **Sign in** with both fields empty. → Messages appear under Email and Password.
2. Sign in as STU-A1 with a wrong password. → "Email or password is incorrect". The same message appears for an email that does not exist (`nobody@example.test`).
3. Sign in as STU-A1, open `UAT-ST-03 Validation` and try each of these submissions. → Each one shows a message under the field and stores nothing:
   - an empty title → "Enter a title (1–120 characters).";
   - a title of 121 characters → the same message;
   - the link `ftp://example.com/x` or `example.com` → "Enter a full link starting with http:// or https://."
4. Submit with a title of exactly **120** characters and the link `https://example.com/uat-03`. → It is accepted, and the full title is shown.
5. Sign in as SUP-A, open the milestone and select **Add feedback** with an empty box, then with spaces only. → "Enter feedback (1–2000 characters)." appears and no entry is added.

### UAT-04: Forbidden role and other team's records
- **Category:** forbidden role / ownership
- **Covers:** AC-02.2, AC-02.4, AC-03.3, AC-03.6, AC-04.7, AC-05.5, AC-06.4
- **Roles:** STU-B1, SUP-B, STU-A1
- **Preconditions:** UAT-01 is done, and you have its milestone URL `/milestones/<id>`.

**Steps and expected results:**
1. Sign in as STU-B1 (Team B). Open **My team**. → Demo Team B, its members (Demo Student 3, Demo Student 4) and supervisor (Demo Supervisor 2) are shown. No Team A member is shown, and no emails or other private fields are shown.
2. As STU-B1, open **Milestones**. → `UAT-ST-01 Proposal` (Team A) is **not** listed.
3. As STU-B1, type the Team A milestone URL from UAT-01 into the address bar. → "Milestone not found." is shown. No title, submission or feedback is shown.
4. As STU-B1, type `/milestones/999999` into the address bar. → The same "Milestone not found." is shown. You cannot tell an existing hidden milestone from a missing one.
5. As STU-B1, type `/teams` (the Supervisor page). → "You do not have permission to view this page." is shown.
6. Sign in as SUP-B (Team B's supervisor). Open **My teams**. → Only Demo Team B is listed. Open the UAT-01 milestone URL. → "Milestone not found."
7. Sign in as STU-A1 and open the UAT-01 milestone. → The submission and feedback are unchanged from UAT-01, so nothing was changed or revealed.

### UAT-05: One submission per team, and records persist
- **Category:** state / history / persistence
- **Covers:** AC-05.4, AC-05.5, AC-05.8, AC-06.3, AC-01.4, AC-01.7 (BR-07)
- **Roles:** SUP-A, STU-A1, STU-A2
- **Preconditions:** SUP-A creates `UAT-ST-05 Persistence`, due tomorrow at 18:00.

**Steps and expected results:**
1. Tab 1: sign in as STU-A1 and open the milestone. Tab 2: sign in as STU-A2 and open it. → Both show the **Submit work** form.
2. In tab 1, submit the title `First` with the link `https://example.com/first`. → The submission is shown.
3. In tab 2, without reloading, submit the title `Second` with the link `https://example.com/second`. → "Your team has already submitted work for this milestone." appears, and the typed values are kept.
4. Reload tab 2. → Only `First` by Demo Student 1 is shown, and the status is "Submitted".
5. As SUP-A, add the feedback `Entry 1`, then `Entry 2`. → Both are listed oldest first.
6. Log out of every tab. Wait at least 5 minutes, then sign in again as STU-A2 and open the milestone. → The same submission (same title and time) and both feedback entries are still there, in the same order.
7. After logging out, type the milestone URL. → You are sent to the Sign in page.

### UAT-06: Team views and a student with no team
- **Category:** normal / role view
- **Covers:** AC-03.3, AC-03.4, AC-03.6
- **Roles:** STU-A1, SUP-A
- **Steps and expected results:**
  1. As STU-A1, open **My team**. → Demo Team A, members Demo Student 1 and Demo Student 2, and supervisor Demo Supervisor 1 are shown.
  2. As SUP-A, open **My teams**. → Only Demo Team A is listed. **View team milestones** opens the Team A list.

  (The no-team state of AC-03.4 is covered by our automated tests. We keep the no-team account for our own smoke test and do not hand it out.)

## 3. Recording results (for the UAT Team)
For each case, record: case ID, tester name and team, date and time (ICT), the `/api/health` commit, the inputs used, the actual result for each step, PASS / FAIL / BLOCKED, and evidence (a screenshot ID). If a step fails, open a GitHub issue in our repository (label `uat`), or send it on Discord. Include the case and step, what you expected, what happened and a screenshot.
