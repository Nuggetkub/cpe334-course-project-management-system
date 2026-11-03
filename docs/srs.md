# Software Requirements Specification (SRS)

**Product:** Course Project Management System
**Course:** CPE 334 — Theme 6 · Semester 1/2026
**Team:** 67070501046 (@Nuggetkub), 67070501069 (@Earth2509)

| Version | Date | Author | Reviewer | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-03 | @Nuggetkub | @Earth2509 | Initial baseline draft (Issue #1) |
| 0.2 | 2026-11-03 | @Nuggetkub | @Earth2509 | Review on PR #14: zero-team students (DEC-02), milestone status model (§4.3.1, DEC-13), late-window scope (DEC-14), NFR-09 method, DEC-11/12 referenced |

---

## 1. Introduction

### 1.1 Stakeholder problem

A university course runs group projects in which student teams deliver work in milestones and
supervisors (instructors/TAs) review it. Today this happens over chat and shared drives:
deadlines are enforced inconsistently, it is unclear which version of the work a comment refers to,
supervisors cannot see at a glance which teams are behind, and students sometimes see other teams'
work or feedback.

### 1.2 Chosen context

The product supports **one course offering** (for example, a CPE 334 group project) with several
project teams of 2–4 students. Each team has one or more assigned supervisors. Supervisors define
milestones (proposal, design review, sprint demos, final report) with deadlines; teams submit a
title, a description and a link to their work (repository, document or video); supervisors give
written feedback and, from Sprint 2, grades.

### 1.3 Purpose of the product

Give teams a single place to submit milestone work against enforced deadlines, preserve every
submission version together with the feedback written about it, and give supervisors a reliable
view of each supervised team's progress — while keeping each team's work private to that team and
its supervisors.

---

## 2. Actors

| Actor | Description | Responsibilities | Introduced |
|---|---|---|---|
| **Student** | A member of at most one project team in the course; may be unassigned (DEC-02) | View own team and its milestones; submit and revise milestone work; read feedback and released grades for own team | Sprint 1 |
| **Supervisor** | An instructor or TA assigned to one or more teams | Create and manage milestones for supervised teams; review submissions; record feedback and grades; release grades; manage membership of supervised teams; view progress | Sprint 1 |
| **System** | The application itself | Enforce deadlines, versioning, role and ownership rules; record timestamps and history | Sprint 1 |

Each account has exactly one role (DEC-07). Accounts are created by the seed procedure; there is
no self-registration (see §3.2).

---

## 3. Scope

### 3.1 In scope

- Authentication (login, logout, current user) with seeded accounts and hashed passwords.
- Role- and ownership-based authorization enforced by the backend.
- Teams and team membership; supervisor–team assignment.
- Milestones with deadlines, editing, deadline extension, closing and an optional late window.
- Submissions (title, description, link) with version history.
- Feedback attached to a specific submission version; grades with release control.
- Progress views for teams and supervisors; filtering; CSV export of progress/grades.

### 3.2 Exclusions

| ID | Excluded | Reason |
|---|---|---|
| EX-01 | Self-registration, password recovery, email verification | Not required by brief; seeded accounts are sufficient |
| EX-02 | Multiple roles per account | Simplifies authorization (DEC-07) |
| EX-03 | Uploading files to the system | Submissions are links to external work; avoids file storage and malware handling |
| EX-04 | Email, push or chat notifications | No external messaging service; reminders are shown in-app only |
| EX-05 | Integration with an LMS, GitHub API or plagiarism checker | No external APIs required |
| EX-06 | Managing several course offerings in the UI | One course offering per deployment; the data model keeps a `course` reference for future use |
| EX-07 | Peer assessment between students | Outside the stakeholder brief |

---

## 4. Functional Requirements

Priority: **M** = must, **S** = should. Sprint = planned sprint for implementation and verification.

### 4.1 Authentication and identity

| ID | Requirement | Priority | Sprint |
|---|---|---|---|
| FR-01 | A user can log in with email and password; on success the system creates a session and returns the user's identity and role. | M | 1 |
| FR-02 | A logged-in user can log out; the session is invalidated on the server and can no longer be used. | M | 1 |
| FR-03 | A logged-in user can retrieve their current identity (id, name, email, role) through a "current user" endpoint. | M | 1 |
| FR-04 | After login the UI shows navigation appropriate to the user's role (Student or Supervisor). | M | 1 |

### 4.2 Teams

| ID | Requirement | Priority | Sprint |
|---|---|---|---|
| FR-05 | A student can view their own team: team name, members and assigned supervisors. A student with no team sees a "You are not assigned to a team yet" message and no milestones. | M | 1 |
| FR-06 | A supervisor can view the list of teams assigned to them. | M | 1 |
| FR-07 | A supervisor can create a team, which is automatically assigned to them, and add or remove student members of their supervised teams. | M | 2 |

### 4.3 Milestones

| ID | Requirement | Priority | Sprint |
|---|---|---|---|
| FR-08 | A supervisor can create a milestone for a supervised team with a title, description and due date/time. | M | 1 |
| FR-09 | A student can view the milestones of their team with each milestone's due date, submission window and team status, as defined in §4.3.1. | M | 1 |
| FR-10 | A supervisor can edit a milestone's title/description and extend its due date. | M | 2 |
| FR-11 | A supervisor can close a milestone so that no further submissions are accepted. | M | 2 |
| FR-12 | A supervisor can allow late submissions for a milestone up to a late-deadline. | S | 2 |

#### 4.3.1 Milestone status model (DEC-13)

Two separate values are shown for each milestone: whether the milestone **accepts work** (window),
and how far **this team** got (team status). All times are server time (BR-06).

**Submission window** — evaluated top to bottom; the first matching row wins.

| Window | Condition | Accepts submissions | Sprint |
|---|---|---|---|
| Closed | A supervisor closed the milestone (FR-11) | No | 2 |
| Open | now ≤ `due_at` (a submission at exactly `due_at` is accepted) | Yes, on time | 1 |
| Late window | `due_at` < now ≤ `late_until` (FR-12) | Yes, marked Late | 2 |
| Closed | Otherwise (deadline passed, no late window or it has ended) | No | 1 |

**Team status** — evaluated top to bottom; the first matching row wins.

| Team status | Condition | Sprint |
|---|---|---|
| Late | The team's latest submission version is marked Late | 2 |
| Submitted | The team has a submission and its latest version is on time; stays Submitted after the deadline passes | 1 |
| Not submitted | No submission, and the window is Open | 1 |
| Overdue | No submission, and the window is not Open (late window or closed) | 1 |

A manual close (FR-11) changes only the window; it does not change the team status.

### 4.4 Submissions

| ID | Requirement | Priority | Sprint |
|---|---|---|---|
| FR-13 | A student can submit work for an open milestone of their team with a title, description and link. | M | 1 |
| FR-14 | Team members can view their team's persisted submission for a milestone, including submitter and submission time. | M | 1 |
| FR-15 | A student can resubmit (revise) work for a milestone while its window accepts work (before the deadline, or within the late window — FR-17); each resubmission creates a new version. | M | 2 |
| FR-16 | Team members and the team's supervisors can view the full version history of a milestone's submissions. | M | 2 |
| FR-17 | A submission made within the late window (FR-12) — a team's first submission or a new version — is accepted and marked **Late** (DEC-14). | S | 2 |

### 4.5 Feedback and grades

| ID | Requirement | Priority | Sprint |
|---|---|---|---|
| FR-18 | A supervisor can record written feedback on a specific submission version of a supervised team. | M | 1 |
| FR-19 | Team members can view the feedback recorded on their team's submissions, shown with the version it refers to. | M | 1 |
| FR-20 | A supervisor can record or update a grade (0–100) for a team's milestone. | M | 2 |
| FR-21 | A supervisor can release the grades of a milestone; students see a grade only after it is released. | M | 2 |

### 4.6 Progress and reporting

| ID | Requirement | Priority | Sprint |
|---|---|---|---|
| FR-22 | A student can view a progress board for their team showing each milestone's status, latest version, feedback status and released grade. | M | 3 |
| FR-23 | A supervisor can view an overview of all supervised teams showing, per milestone, whether work is submitted, late, missing or awaiting feedback. | M | 3 |
| FR-24 | Supervisors can filter milestones and submissions by team and status. | S | 3 |
| FR-25 | A supervisor can export a CSV summary of progress and grades for their supervised teams. | S | 3 |

---

## 5. Business Rules

| ID | Rule | Enforced by | Sprint |
|---|---|---|---|
| BR-01 | Only Supervisors may create or change milestones, record feedback, record/release grades and manage team membership. | API (role check) | 1 (S2 for grades/teams) |
| BR-02 | A supervisor may read or act on a team's data only if they are assigned to that team. | API (ownership check) | 1 |
| BR-03 | A student may read only their own team's milestones, submissions, feedback and released grades. Requests for another team's records are rejected without revealing them. | API (ownership check) | 1 |
| BR-04 | A student belongs to at most one team in the course and may belong to none (DEC-02). A student with no team has no team-scoped data: their requests for team milestones, submissions or feedback return 404 (DEC-10), and the UI shows the FR-05 empty state. | DB unique constraint + API | 1 (seed), 2 (UI) |
| BR-05 | A milestone's title is 1–120 characters and its due date must be in the future when the milestone is created or extended. | API validation | 1 |
| BR-06 | A submission is rejected when the server time is later than the milestone's due date, unless it falls within an allowed late window (BR-12). The client's clock is never used. | API (server time) | 1 |
| BR-07 | **Sprint 1 only:** a team has at most one submission per milestone; a second submission is rejected. Superseded by BR-08 in Sprint 2 (DEC-04). | API + DB unique constraint | 1 |
| BR-08 | From Sprint 2, a submission made before the deadline when one already exists creates version N+1. Earlier versions are never changed or deleted. | API + DB | 2 |
| BR-09 | A submission title is 1–120 characters, the description at most 2000 characters, and the link must be an absolute `http` or `https` URL. | API validation (+ UI) | 1 |
| BR-10 | Feedback is attached to exactly one submission version and stays attached to it when newer versions are submitted. Feedback text is 1–2000 characters. | API + DB foreign key | 1 |
| BR-11 | Submissions to a Closed milestone are rejected, regardless of the deadline. | API | 2 |
| BR-12 | A late window, if set, must end after the due date. While it is open, both a team's first submission and a new version (N+1) are accepted; every version created in it is marked Late (DEC-14). | API | 2 |
| BR-13 | A due-date change may only extend the deadline (new due date later than the current one). | API | 2 |
| BR-14 | A milestone that has submissions cannot be deleted; it can only be closed. | API | 2 |
| BR-15 | A grade is an integer from 0 to 100. A student sees a grade only after the supervisor has released it for that milestone. | API | 2 |
| BR-16 | A student cannot be removed from a team if they have authored submissions for that team; submission authorship is preserved. | API | 2 |

---

## 6. Non-Functional Requirements

| ID | Category | Requirement and measurable target | Verification method | Sprint |
|---|---|---|---|---|
| NFR-01 | Security | Passwords are stored only as bcrypt hashes (cost ≥ 10); no plaintext password is stored or returned by any endpoint. | Integration test reads the seeded user row and asserts a bcrypt hash; API test asserts no `password` field in responses | 1 |
| NFR-02 | Security | 100% of protected endpoints reject unauthenticated requests with HTTP 401 and return no private data. | API test per protected endpoint | 1 (re-run 2, 3) |
| NFR-03 | Security | 100% of protected endpoints reject requests outside the caller's role or ownership with HTTP 403 (or 404 for other teams' records) and return no private data. | API tests per endpoint for wrong role and cross-team access | 1 (extended 2, 3) |
| NFR-04 | Security | A session expires 8 hours after login; after logout the same token is rejected immediately. | API test (logout) + unit test of expiry calculation | 1 |
| NFR-05 | Reliability | Error responses use one JSON shape `{ "error": { "code", "message" } }` and never include stack traces or SQL. | API tests on validation, auth and not-found errors | 1 |
| NFR-06 | Data integrity | All deadlines are stored in UTC and compared using server time; the UI displays them in Asia/Bangkok time. | Unit tests on deadline comparison at boundary (due − 1 s, due, due + 1 s) | 1 |
| NFR-07 | Durability | Data survives an application restart and a redeployment. | Post-deployment check: create record → restart/redeploy → retrieve record | 2 (Lab 5) |
| NFR-08 | Reproducibility | A new developer can clone, configure from `.env.example`, migrate, seed and run all tests using only the README, in ≤ 15 minutes. | Timed walkthrough by the teammate on a clean machine/container | 1 (local), 2 (Docker) |
| NFR-09 | Performance | With the demo seed scaled to 20 teams and 200 submissions, these list endpoints respond with p95 < 500 ms on the deployed instance: a team's milestones, a milestone's submissions, and the supervisor team overview (first page, default page size 50). | Script against the GCP deployment: 5 warm-up requests discarded, then 50 sequential requests (concurrency 1) per endpoint; cold-start latency recorded and reported separately, not counted in p95 | 3 |
| NFR-10 | Usability | Every form shows field-level validation messages and server error messages; every list shows loading and empty states. | Playwright E2E checks on submission and milestone forms | 1 (core forms), 3 (all) |
| NFR-11 | Maintainability | Every PR into staging or main passes the build and automated tests before merge. | CI required check on protected branches | 2 (Lab 5) |
| NFR-12 | Security | No secrets (passwords, tokens, keys) are committed to the repository or shipped in client code. | `.env` ignored; secret scan in CI; review checklist | 1 (manual), 2 (CI) |

---

## 7. Assumptions

| ID | Assumption |
|---|---|
| AS-01 | One course offering is managed per deployment; accounts, teams and supervisors are seeded for demonstration. |
| AS-02 | The server clock is the authority for deadlines; the deployment host keeps time synchronised (NTP). |
| AS-03 | Submission links point to work hosted elsewhere (GitHub, Google Drive, YouTube); the system does not check that the link is reachable. |
| AS-04 | A team has 2–4 students and 1–2 supervisors; the system does not enforce team size. |
| AS-05 | All demo data is synthetic; no real student information is stored. |
| AS-06 | Users access the system from a current desktop browser (Chrome, Edge or Firefox). |

---

## 8. Decisions and open questions

Design decisions are recorded in [`decisions.md`](decisions.md) and referenced here.

| Decision | Summary | Affects |
|---|---|---|
| DEC-02 | At most one team per student per course; an unassigned student sees an empty state | §2, BR-04, FR-05, FR-07 |
| DEC-03 | Server-time deadline enforcement | BR-06, NFR-06 |
| DEC-04 | One submission per milestone in Sprint 1; versioned resubmission from Sprint 2 | BR-07, BR-08, FR-15, FR-16 |
| DEC-05 | Supervisors act only on assigned teams | BR-02, FR-06 |
| DEC-06 | Team members see own-team feedback; grades hidden until released | FR-19, FR-21, BR-15 |
| DEC-07 | Two roles, one per account | §2, EX-02 |
| DEC-09 | Team management done by supervisors for their own teams (no separate admin role) | FR-07, BR-01, BR-16 |
| DEC-10 | Cross-team access returns 404 rather than 403 so other teams' record IDs are not confirmed | BR-03, BR-04, NFR-03 |
| DEC-11 | One staging branch per sprint; CI and the Lab 5 ruleset cover `main` and `staging/**` | Delivery process (Lab 5–7) |
| DEC-12 | Cloud-ready Sprint 1: DB sessions, `PORT` from env, `/api/health` + `/api/ready`, env-sourced idempotent seed, `/api/auth/*` | FR-01–03, NFR-04, NFR-08, NFR-12 |
| DEC-13 | Milestone window and team status are separate values with fixed precedence | FR-09, FR-11, FR-22–24, §4.3.1 |
| DEC-14 | The late window accepts a first submission and new versions; each is marked Late | FR-12, FR-15, FR-17, BR-08, BR-12 |

| Open question | Owner | Status |
|---|---|---|
| Final demo video length (≤ 10 min / 8 pts in master spec vs ≤ 4 min / 10 pts in final handout) | Both — ask instructor | Open; planning for 4 minutes |
