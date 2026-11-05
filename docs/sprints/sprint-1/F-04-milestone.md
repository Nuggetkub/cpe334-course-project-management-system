# F-04 Milestones: create and view — Engineering Contract

**Issue:** #9 · **Owner:** @Earth2509 · **Reviewer:** @Nuggetkub · **Branch:** `feature/9-f04-milestones`
**Requirements:** FR-08, FR-09, BR-01–BR-05, NFR-02, NFR-03, NFR-05, NFR-06, NFR-10.
**Baseline:** SRS v0.2; F-02 v0.2; F-05 v0.1 §1.3; DEC-10 and DEC-13.

| Version | Date | Author | Reviewer | Change |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-11-05 | @Earth2509 | @Nuggetkub (requested at PR) | Contract and planned tests recorded before migration, tests and implementation |

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

| AC | Observable result | Requirements |
| --- | --- | --- |
| AC-04.1 | Assigned and co-assigned Supervisors create valid milestones → 201; DB and later GET contain the same title, UTC due time and session-derived author | FR-08 |
| AC-04.2 | Invalid title/description/due date → 400 fields, no write; form displays errors, including server-time rejection | BR-05, NFR-10 |
| AC-04.3 | Students see only own-team rows with Asia/Bangkok time, window and team status; title opens authorized detail | FR-09, NFR-06 |
| AC-04.4 | At due−1s / due / due+1ms / due+1s: OPEN/OPEN/CLOSED/CLOSED and NOT_SUBMITTED/NOT_SUBMITTED/OVERDUE/OVERDUE | FR-09, NFR-06 |
| AC-04.5 | 5xx/network during creation preserves values, shows safe error and permits retry | NFR-10 |
| AC-04.6 | List announces loading; empty shows "No milestones yet"; failure offers Retry | FR-09, NFR-10 |
| AC-04.7 | Wrong-role create → 403; other-team/no-team/unassigned reads or writes → fixed 404; malformed JSON never outranks auth/ownership | BR-01–BR-04, NFR-02, NFR-03, NFR-05 |
| AC-04.8 | Lists paginate 50 rows in dueAt/id order; next/previous load requested pages; switching team hides old rows | FR-09, NFR-10 |

## 4. Software Test Specification

U = Vitest without business DB queries; I = real Supertest/PostgreSQL cpms_test; C = React with
mocked fetch; E = real Chromium/API/DB cpms_e2e. No public schema is reset.

| Test | AC | Level | Input/action | Expected |
| --- | --- | --- | --- | --- |
| TEST-04.2u | 04.2 | U | Blank/trimmed/120/121 title, astral characters, optional/2000/2001 description, nonstrings/array; explicit UTC and offsets, invalid calendar/time/offset, equal/past/future due | Valid values normalized; invalid HttpError fields; no silently rolled calendar dates |
| TEST-04.4u | 04.4 | U | due−1s, due, due+1ms, due+1s | Window and no-submission statuses match AC |
| TEST-04.1i | 04.1 | I | pA/pA2 create for A; forged author/team/time body; DB lookup and reload | 201, persisted trimmed input, actual actor/team/time, no private fields |
| TEST-04.2i | 04.2 | I | Valid authorized scope, invalid fields and due<=now | 400 fields, unchanged count |
| TEST-04.3i | 04.3,04.4 | I | sA,pA,pA2 read A; fixed now; due boundaries | Only A, UTC values and correct statuses/detail |
| TEST-04.7i | 04.7 | I | No auth, wrong role, other/no team, unassigned, missing/malformed ID; malformed body | Fixed 401→403→404→400 precedence and no write; extends TEST-02.1 |
| TEST-04.8i | 04.8 | I | 51 A rows with tied due dates, one B row; pages1/2; invalid page | 50 then1, stable ID tie break, total51, no B row; invalid400 after ownership |
| TEST-04.6c | 04.6 | C | Deferred list; empty; failure then Retry | Loading, empty and recovery visible |
| TEST-04.2c | 04.2 | C | Empty form; API field400 after filled form | No invalid POST; server error next to matching field; values retained |
| TEST-04.5c | 04.5,04.1 | C | Pending POST, 500/network, successful retry | Disabled busy form; safe failure, values kept; success refreshes first page/total |
| TEST-04.3c | 04.3 | C/U | UTC deadline; browser timezone independent conversion; Student view/detail and no-team | Bangkok output; no create form; safe no-team/not-found |
| TEST-04.8c | 04.8 | C | Next page, switch teams while old fetch pending | Correct page; no old-team rows replace new-team content |
| TEST-04.1e | 04.1,04.3 | E | Supervisor creates for seeded team; Student logs in, opens list/detail, reloads | Real persisted data, two badges, Bangkok due time, no Student form |
| TEST-04.2e | 04.2,04.6 | E | Empty fresh list, invalid form, valid-looking past due | Empty and field feedback; real server rejects past due400 |

14 STS rows; parameterized inputs expand into multiple executable cases. Record actual counts.
Commit order: contract → additive migration → tests/red run → implementation/green run. Missing
imports are reported separately from behavioral red failures; never claim a module-load failure
proved a business-rule assertion. Existing auth/seed/team regressions must remain green.

## 5. Definition of Done

- [x] API, DB and UI above implemented without unrelated authentication changes.
- [x] Red/green runs recorded with commands, commit IDs and limitations below.
- [ ] All server tests/typecheck/build, client tests/build and browser tests pass; no skipped/weakened tests.
- [x] README, traceability and AI-use/contribution records updated.
- [x] F-05 interface agreement preserved and documented for review below.
- [ ] @Nuggetkub peer review completed; PR merged into staging/sprint-1. Release to main is separate.

## 6. Implementation and verification record

Base: `44e4ae5` on staging/sprint-1. Contract `33e4f05` → additive model/migration `ed26f11`
→ test-first commit `dd83ca1` → implementation `143c4c2`. No F-01 session-expiry changes from
the separate PR #33 are included. Tests operate only on local disposable schemas.

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

### Local verification on `143c4c2` (5 Nov 2026, Node v24.14.0)

| Command from repository root | Result |
| --- | --- |
| `npm --prefix server test` | 10 files / 124 tests passed, no skips (42.48 s; repeat after final changes 41.61 s) |
| `npm --prefix server run typecheck` | Passed source and test TypeScript checks |
| `npm --prefix server run build` | Passed |
| `npm --prefix client test` | 4 files / 33 tests passed, no skips (2.92 s) |
| `npm --prefix client run build` | Passed |
| `npm run e2e -- --reporter=list` | All 4 cases reported `ok`, including the real create/read and past-deadline rejection. Sandbox runner stalled during server teardown; interrupted, so a complete exit-0 browser repeat is still required |
| `git diff --check` | Passed |

Browser infrastructure attempts are separate from assertions: initial launch failed because
Chromium v1248 was missing; after official Playwright installation in a local workspace cache,
the four tests reported `ok`. No tests or assertions were disabled, and the incomplete runner is
not presented as a complete successful E2E run. Port 3101/4173 processes from the interrupted
run were stopped before asking the developer to repeat it outside the sandbox.

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
