# F-04 Milestones: create and view — Engineering Contract

**Issue:** #9 · **Owner:** @Earth2509 · **Reviewer:** @Nuggetkub · **Branch:** `feature/9-f04-milestones`
**Requirements:** FR-08, FR-09, BR-01–BR-05, NFR-02, NFR-03, NFR-05, NFR-06, NFR-10.
**Baseline:** SRS v0.2; F-02 v0.2; F-05 v0.1 §1.3; DEC-10 and DEC-13.

| Version | Date | Author | Reviewer | Change |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-11-05 | @Earth2509 | @Nuggetkub (approved `8adf0b1` in PR #35) | Contract and planned tests recorded before migration, tests and implementation |
| 0.2 | 2026-11-05 | @Earth2509 | @Nuggetkub (post-review corrections) | PR #35: Given/When/Then ACs, explicit STS preconditions and missing TEST-04.6i (15 rows); reviewer-reproduced API red evidence; staging integration retains PR #33's F-01 contract |

## 1. Feature design

A Supervisor selects an assigned team and creates a milestone. Students read only their own
team's milestones; all assigned co-supervisors can read/create for that team. A Student with no
team sees the FR-05 empty state. Supervisors with no assignments see "No teams assigned yet".
The UI hides the create form from Students; the API enforces the permission independently.

### Workflow and authorization

`POST /api/teams/:teamId/milestones`: requireAuth (401) → requireRole(SUPERVISOR) (403)
→ requireTeamAccess (404) → jsonBody (400) → validation (400) → insert → 201.
`GET /api/teams/:teamId/milestones`: requireAuth → requireTeamAccess → scoped query → 200.
`GET /api/milestones/:milestoneId`: requireAuth → parseId → load owning team → assertTeamAccess
→ 200. Hidden, nonexistent, malformed or out-of-range IDs all use the fixed F-02 404 body.
Every endpoint joins the protected-endpoint list. Lists constrain team ownership in the query,
never by loading other teams' data and filtering it in memory.

| Operation | Anonymous | Student own team | Student other/no team | Assigned Supervisor | Other Supervisor |
| --- | --- | --- | --- | --- | --- |
| Create | 401 | 403 | 403 | 201 if valid | 404 |
| List/detail | 401 | 200 | 404 | 200 | 404 |

### Validation and boundaries

| Field | Rule | Field message |
| --- | --- | --- |
| title | Required string, trimmed; 1–120 Unicode code points | Enter a title (1–120 characters). |
| description | Optional string; missing defaults to empty; trimmed; ≤2000 code points (feature-level bounded-text decision) | Description must be at most 2000 characters. |
| dueAt | Required explicit-zone ISO timestamp `YYYY-MM-DDTHH:mm:ss[.SSS]Z` or ±HH:mm (offset ≤14:00); valid calendar/time, 1–9999 AD; strictly later than the server instant | Enter a valid future due date and time. |

Reject arrays/non-object JSON, non-string fields, timezone-free dates, impossible dates, leap
seconds, invalid offsets, and dates equal to or before now. Read the injected clock once per
write; use that instant for validation and createdAt. Ignore unknown fields including teamId,
createdBy and createdAt: URL ownership and the authenticated actor are authoritative.
Description limit and deterministic ordering below are design details, not new SRS requirements.

### Dependencies and scope

F-01–F-03 are integrated into staging. This feature provides the additive Milestone model,
`server/src/milestones/status.ts`, `createApp({ now })` / `app.locals.now`, and
`client/src/time.ts` / `formatBangkok(iso)`, as agreed in F-05 §1.3.
`submissionWindow(dueAt, now)` returns OPEN through the deadline inclusive, otherwise CLOSED.
`teamStatus(dueAt, hasSubmission, now)` initially returns NOT_SUBMITTED / OVERDUE when false.
F-05 owns adding SUBMITTED and passing actual submission existence into list responses.
No submissions, lifecycle edits, manual closing, late windows, grades or feedback are implemented here.

## 2. Layer specifications

### API

All success times are ISO UTC strings; errors use `{error:{code,message,fields?}}` (NFR-05).

| Endpoint | Request | Success |
| --- | --- | --- |
| POST /api/teams/:teamId/milestones | `{title,description?,dueAt}` | 201 `{milestone}` |
| GET /api/teams/:teamId/milestones?page=N | Positive integer page (default 1), fixed size 50 | 200 `{milestones,page,pageSize:50,total}`; empty collection is 200, not 404 |
| GET /api/milestones/:milestoneId | No body | 200 `{milestone}` |

Milestone response: `{id,teamId,title,description,dueAt,createdBy,createdAt,window,teamStatus}`.
`createdBy` is a public numeric author ID, never an account object. Order list by dueAt ASC, id ASC;
read one server instant for all statuses in a response. Invalid page → 400 only after ownership.
Pagination follows the system SDS's default 50 and prevents silently hiding older milestones.
GET detail is a read-only bridge at `/milestones/:milestoneId`; F-05 extends that page with its
submission GET/form and can reuse this response. Existing nested F-05 paths remain available.

### Data

Add `milestones`: id serial PK; team_id int FK teams RESTRICT; title varchar(120);
description varchar(2000) NOT NULL default ''; due_at timestamp(3) NOT NULL (UTC values);
created_by int FK users RESTRICT; created_at timestamp(3) NOT NULL default now().
Index `(team_id,due_at,id)`. Existing tables/columns and demo seed are preserved. Test cleanup
deletes milestones before their team/author; it operates only on cpms_test, never public.
No deployment variables are added; the clock is a code-only injection, not an env override.

### UI

`/milestones` discovers own team (Student) or assigned teams (Supervisor), then loads that team's
first page. Supervisor team selector remounts the team's content so pending results/form state
cannot leak across teams. `/teams/:teamId/milestones` supports direct links with API authorization.
Team views link to the scoped list; every title links to `/milestones/:milestoneId`.
List shows title, description, Bangkok due time, separately labelled window/team-status badges,
and Previous/Next pagination. Announce loading/empty and errors with Retry. Hidden scope/detail
shows a safe not-found message without old data. Detail shows the same read-only fields.

Create form: labelled Title, optional Description, and Due date/time (Asia/Bangkok) datetime-local.
Interpret input explicitly as UTC+07:00 regardless of browser timezone; API receives an explicit
zone. Browser checks required/length/calendar constraints, but the server alone decides future.
Client-side invalid fields send no POST; server `fields` display beside their inputs. Saving
disables the entire form and shows "Creating milestone…". 5xx/network retains all fields,
shows "Could not create milestone. Please try again." and permits retry. Success clears fields,
announces creation, and reloads page 1 and its total (the new row need not be on page 1).
Keyboard focus, labels, error descriptions, long-text wrapping and readable layout follow the
existing app styles. F-01 session handling remains shared; do not add a competing 401 handler.

## 3. Acceptance criteria

| AC | Given | When | Then (observable result) | Requirements |
| --- | --- | --- | --- | --- |
| AC-04.1 | A signed-in Supervisor or co-supervisor is assigned to team A | They create a milestone for A with valid input, then read it again | POST returns 201; DB and later GET contain the same title, UTC due time and session-derived author | FR-08 |
| AC-04.2 | The caller passed all guards; input has an invalid title/description/date, or dueAt is not later than server now | They submit the create form or POST the body | API returns 400 fields and writes no row; the form displays matching field errors, including server-time rejection | BR-05, NFR-10 |
| AC-04.3 | A signed-in Student belongs to team A, with milestones in A and B | They open A's milestone list and select a title | Only A's rows appear, with Asia/Bangkok due time and separate window/team status; the title opens authorized detail | FR-09, NFR-06 |
| AC-04.4 | A milestone has no submission and a fixed dueAt | The server evaluates it at due−1s, due, due+1ms and due+1s | Window is OPEN/OPEN/CLOSED/CLOSED and team status is NOT_SUBMITTED/NOT_SUBMITTED/OVERDUE/OVERDUE | FR-09, NFR-06 |
| AC-04.5 | A Supervisor has entered valid form values | Creation receives 5xx or fails on the network | Values remain, a safe error appears, submitting controls are re-enabled and the Supervisor can retry | NFR-10 |
| AC-04.6 | A team is authorized and its list request is pending, empty or fails | The user opens the list, or selects Retry after failure | Loading is announced; an empty success shows "No milestones yet"; failure shows a safe error and Retry | FR-09, NFR-10 |
| AC-04.7 | Requests come from an anonymous user, wrong-role creator, other/no-team Student, or unassigned Supervisor | They create/read scoped data, including malformed IDs or JSON | Authentication returns 401 first, wrong-role create 403 next, hidden/missing scope the fixed 404 next, and body validation 400 only after guards; denied requests write nothing | BR-01–BR-04, NFR-02, NFR-03, NFR-05 |
| AC-04.8 | Team A has more than 50 milestones, including tied due dates; the Supervisor can select another assigned team | They request next/previous pages or switch teams while an old request is pending | Pages contain at most 50 rows in dueAt ASC/id ASC order with correct totals; pending old-team results cannot replace the selected team's rows | FR-09, NFR-10 |

## 4. Software Test Specification

U = Vitest without business DB queries; I = real Supertest/PostgreSQL cpms_test; C = React with
mocked fetch; E = real Chromium/API/DB cpms_e2e. No public schema is reset.

| Test | AC | Level | Precondition/input | Action | Expected |
| --- | --- | --- | --- | --- | --- |
| TEST-04.2u | 04.2 | U | Fixed server now; blank/trimmed/120/121 title, astral characters, optional/2000/2001 description, nonstrings/array; explicit UTC/offsets and invalid/equal/past dates | Call parseMilestone for each input | Valid values normalized; invalid HttpError fields; no silently rolled calendar dates |
| TEST-04.4u | 04.4 | U | Fixed dueAt; no submission; now at due−1s, due, due+1ms, due+1s | Call submissionWindow and teamStatus | Window and no-submission statuses match AC |
| TEST-04.1i | 04.1 | I | pA/pA2 assigned to A; valid body plus forged author/team/time | POST for A, inspect DB row and GET detail as sA | 201, persisted trimmed input, actual actor/team/time, no private fields |
| TEST-04.2i | 04.2 | I | pA authorized for A; invalid fields or dueAt<=fixed now | POST each invalid body; count rows | 400 fields, unchanged count |
| TEST-04.3i | 04.3,04.4 | I | A and B have milestones; fixed now; sA,pA,pA2 authorized for A | Read A list/detail at due boundaries | Only A, UTC values and correct statuses/detail |
| TEST-04.6i | 04.6 | I | Team A exists, sA is a member, and A has no milestones | GET A's milestone list as sA | 200 with milestones=[], page=1, pageSize=50, total=0; empty authorized collection is not hidden/missing scope |
| TEST-04.7i | 04.7 | I | No auth, wrong role, other/no team, unassigned, missing/malformed ID; malformed JSON | POST/GET with combined invalid credentials/scope/body; compare fixed errors and DB count | Fixed 401→403→404→400 precedence and no write; extends TEST-02.1 |
| TEST-04.8i | 04.8 | I | 51 A rows with tied due dates, one B row; authorized sA and invalid page values | GET pages1/2 and invalid pages for owned/hidden teams | 50 then1, stable ID tie break, total51, no B row; invalid400 after ownership |
| TEST-04.6c | 04.6 | C | Mocked deferred list, empty success, and failure followed by empty success | Render list, resolve fetch and select Retry | Loading, empty and recovery visible |
| TEST-04.2c | 04.2 | C | Supervisor form; empty inputs, then valid-looking values and API field400 | Submit empty form, fill it and submit again | No invalid POST; server error next to matching field; values retained |
| TEST-04.5c | 04.5,04.1 | C | Filled Supervisor form; deferred POST, then 500/network, then successful retry | Submit, resolve failure and retry successfully | Disabled busy form; safe failure, values kept; success refreshes first page/total |
| TEST-04.3c | 04.3 | C/U | Known UTC deadline, datetime-local Bangkok input, Student session; ready/no-team/hidden responses | Convert/format time and render Student list/detail/no-team states | Bangkok output; no create form; safe no-team/not-found |
| TEST-04.8c | 04.8 | C | More than one mocked page; two assigned teams and a deferred old-team fetch | Request Next; select another team, then resolve old fetch | Correct page; no old-team rows replace new-team content |
| TEST-04.1e | 04.1,04.3 | E | Real seeded Supervisor/Student share an empty journey team | Supervisor creates; Student signs in, opens list/detail and reloads | Real persisted data, two badges, Bangkok due time, no Student form |
| TEST-04.2e | 04.2,04.6 | E | Real seeded validation team has no milestones | Open list, submit empty form, then valid-looking past due date | Empty and field feedback; real server rejects past due400 |

15 STS rows; parameterized inputs expand into multiple executable cases. Record actual counts.
Commit order: contract → additive migration → tests/red run → implementation/green run. Missing
imports are reported separately from behavioral red failures; never claim a module-load failure
proved a business-rule assertion. Existing auth/seed/team regressions must remain green.

## 5. Definition of Done

- [x] API, DB and UI above implemented without unrelated authentication changes.
- [x] Red/green runs recorded with commands, commit IDs and limitations below.
- [x] All server tests/typecheck/build, client tests/build and browser tests pass; no skipped/weakened tests. Browser completion confirmed by the developer's repeat below.
- [x] README, traceability and AI-use/contribution records updated.
- [x] F-05 interface agreement preserved and documented for review below.
- [x] @Nuggetkub independently reviewed and approved `8adf0b1` in [PR #35](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/35#pullrequestreview-5787776325).
- [ ] Post-review corrections confirmed and PR merged into staging/sprint-1. Release to main is separate.

## 6. Implementation and verification record

Base: `44e4ae5` on staging/sprint-1. Contract `33e4f05` → additive model/migration `ed26f11`
→ test-first commit `dd83ca1` → implementation `143c4c2`. The original feature head did not bundle
F-01 session-expiry changes. After peer review, merged staging baseline `e3420eb` brings the already
reviewed PR #33 into this branch; retain traceability v0.9 followed by v0.10. Tests operate only on
local disposable schemas.

### Red evidence and limits

At `dd83ca1`, before application implementation, `npm --prefix client test -- tests/milestones.test.tsx`
failed all 10 new cases against the placeholder screen (11.85 s). That run is UI behavioral red
evidence. The local full output is retained outside the repository as
`outputs/cpms-f04-red-client.log`; the missing Title, Team, list and status controls caused failures.

The attempted API red run was blocked in global setup because Docker/PostgreSQL was unavailable.
It did **not** exercise API assertions, and is not counted as behavioral red evidence. The new unit
modules also did not exist at the test-first commit; no unit business-rule red run is claimed.
Once the database became available, the implementation was already present. Additional time-format,
hidden-detail, page-range and E2E cases were added during implementation; they are regression checks,
not claimed as originally captured red tests.

**Reviewer-reproduced API red:** in the [PR #35 review](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/35#pullrequestreview-5787776325),
@Nuggetkub checked out `dd83ca1` with Docker available and ran, from server/,
`npx vitest run tests/milestones.test.ts tests/milestones-units.test.ts`. All **7 integration cases
failed on real assertions**: expected 201/400/200/403/401 but received the unmounted-route 404.
The unit file failed to load because `../src/milestones/validate.js` did not yet exist. This is
reviewer-reproduced behavioral API red at the test-first commit, not an author-captured pre-code
run and not evidence of unit-rule failures. The original author's infrastructure limitation above
remains part of the chronology.

### Local verification (5 Nov 2026, Node v24.14.0)

Application/test source: `143c4c2`; `8d14848` changed only this verification document. The developer
repeated E2E on the same branch after `8d14848`, using the commands supplied in the handoff.

| Command from repository root | Result |
| --- | --- |
| `npm --prefix server test` | 10 files / 124 tests passed, no skips (42.48 s; repeat after final changes 41.61 s) |
| `npm --prefix server run typecheck` | Passed source and test TypeScript checks |
| `npm --prefix server run build` | Passed |
| `npm --prefix client test` | 4 files / 33 tests passed, no skips (2.92 s) |
| `npm --prefix client run build` | Passed |
| `npm run e2e -- --reporter=list` | Developer's completed Command Prompt repeat: **4 passed (9.5 s)**, no skips; includes two auth regressions and two real milestone journeys |
| `git diff --check` | Passed |

Browser infrastructure attempts are separate from assertions: initial launch failed because
Chromium v1248 was missing; after official Playwright installation in a local workspace cache,
the four tests reported `ok`, but that sandbox attempt stalled during server teardown and was
interrupted. It is not counted as a complete run. Port 3101/4173 processes were stopped before the
developer's completed repeat outside the sandbox. The developer supplied all four `ok` lines and
the final `4 passed (9.5s)` summary. No tests or assertions were disabled. The repeat used the
disposable `cpms_e2e` schema and the official Chromium cache under local `outputs/playwright-browsers`.

### Independent peer review

@Nuggetkub approved `8adf0b1` in the review linked above and reported server **124/124**, source/test
typecheck and both builds passing, client **33/33**, and a completed browser run **4/4 (24.0 s)**.
Their trial merge with PR #33 had only the expected traceability version-row conflict and passed
the combined client suite **38/38**. Those are reviewer-reported results, separate from the author
and developer runs above. Contract v0.2 addresses the three requested P3 documentation items;
optional UI/presentation nits are deferred and introduce no extra code change in this correction.

### Post-review staging integration

Merge commit `81cb720` includes staging `e3420eb` (PR #33). The traceability conflict was resolved
by retaining both complete version rows in order, v0.9 then v0.10, and both sets of acceptance
criteria. Local checks on that combined source passed: client **38/38 across 5 files (3.13 s)**,
client production build, and `git diff --check`. Server source, migrations and E2E test files are
unchanged from the reviewed F-04 head; the server/E2E results above retain their original run
provenance and are not presented as fresh reruns after this merge. The v0.2 correction changes
only this contract document. A reviewer can confirm the docs without a new feature-code delta.

### F-05 handoff

- Prisma `Milestone` exposes `id`, `teamId` (database `team_id`), `title`, `description`, `dueAt`
  (`timestamp(3)` UTC), `createdBy`, `createdAt`; no Submission table is pre-created.
- `createApp({ now })` stores the supplied/default server clock in `app.locals.now`.
- `submissionWindow(dueAt, now)` already implements the inclusive deadline. `teamStatus` currently
  handles the no-submission path; F-05 adds SUBMITTED and passes actual existence into list responses.
- `formatBangkok(iso)` is shared in `client/src/time.ts`. List titles link to `/milestones/:milestoneId`;
  `MilestonePage.tsx` is the read-only bridge for F-05 to extend with its own submission endpoint/form.
- List reads are paginated at 50 and sorted dueAt ASC/id ASC; preserve ownership and status behavior
  when adding submission relations. The E2E fixture now has a shared journey team and a validation team.
- Peer approval, integration, issue closure and release are separate gates, not claimed by local tests.
