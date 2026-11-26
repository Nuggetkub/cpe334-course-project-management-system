# F-13 CSV export of progress and grades. Engineering contract

**Issue:** [#86](https://github.com/Nuggetkub/cpe334-course-project-management-system/issues/86) · **Owner:** @Earth2509 · **Reviewer:** @Nuggetkub · **Implementation branch:** `feature/86-f13-csv-export`.

**Requirements:** FR-25, BR-02, BR-15, NFR-03, NFR-05, NFR-10; DEC-05, DEC-06, DEC-10. **Depends on:** [F-12](F-12-supervisor-overview.md) for Supervisor scope, filters and row order; F-10 (#83) for the published grade. **D2 target:** contract, AC and STS only. Implementation targets Final Delivery through `staging/sprint-3` once the dependencies are integrated; not part of `v0.6.0`.

| Version | Date (ICT) | Author | Reviewer | Change |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-11-25 | @Earth2509 | @Nuggetkub (requested with contract PR) | Proposed scope, CSV format, acceptance criteria and planned tests before code. |
| 0.2 | 2026-11-25 | @Earth2509 | [PR #97 review](https://github.com/Nuggetkub/cpe334-course-project-management-system/pull/97#pullrequestreview-6053874847) | Align ordering with F-12, use the shared F-10 projection, use the existing validation error envelope at the export limit, and restrict the formula escape to the two user-text columns. |

## 1. Feature design and API

From the Supervisor Overview, **Download CSV** exports all milestones matching the active applied Team and State filters, not just rows on the current page. Export is a fresh read, using one server instant for status mapping; data may have changed since the Overview last loaded. Given unchanged data and the same clock, CSV rows match the Overview's combined pages in the same order. Grades do not affect filters or sorting.

`GET /api/overview/export?team=ID&state=S&state=T` uses F-12's authentication, Supervisor role, query parsing, scoped team resolution, state derivation and exact order: **team name, then `dueAt`, then milestone `id`**. Reuse those functions/query builder; do not create a separate authorization rule or filter the result in the browser. Repeated valid state values are ORed, and a team filter intersects those states. `page` is not used by export; the UI sends only `team` and repeated `state` values.

- Anonymous → `401`, Student → `403`, valid filter for a missing or unsupervised team → F-12's identical generic `404`, invalid `team`/`state` syntax → the F-12 field error. All denial/error responses use the JSON error envelope and no attachment. Supervisor with no teams or no matching milestones → a valid header-only CSV, not an error.
- `200` success returns `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="cpms-progress.csv"` and `Cache-Control: no-store`. Do not embed names or filter text in the filename. Fetch at most 10,001 scoped matches in stable order; if more than 10,000 match, return the existing `400 VALIDATION_ERROR` JSON envelope with `fields.filters` explaining how to narrow the export. Do not silently truncate, send a CSV body, or start a download on failure.
- Leave Overview queries and rendering unchanged. Read grades in the same scoped data query and use F-10's `studentGrade(row)` from `server/src/grades/projection.ts` as the only source of `grade_released` and `grade_score`. Do not export unpublished drafts, including edits made after a prior release. Score `0` exports as `0`, never as blank. Do not export email, session data, submission links, feedback text or other unlisted fields.

## 2. Format and UI

Exact header order:

```text
team_id,team_name,milestone_id,milestone_title,due_at_utc,window,submission_state,feedback_state,latest_version,grade_released,grade_score
```

Use UTF-8 with one BOM for spreadsheets that otherwise misread Thai text, comma separators, CRLF record endings, and double quotes around cells containing commas, quotes or newlines; double embedded quotes. `due_at_utc` is an ISO 8601 UTC string. Enums and `latest_version` use F-12 values. `latest_version` is blank with no submission. `grade_released` is `true` or `false`; `grade_score` is blank until a published value exists. Only `team_name` and `milestone_title` receive the formula-text prefix: add a plain-text apostrophe before CSV quoting if their first significant character is `=`, `+`, `-` or `@`, or if a leading tab/line break could alter interpretation. No other column receives the prefix; normal CSV quoting still applies to all columns. Compare exact milestone IDs and states for filter parity, and compare names subject to this documented escape.

Use the current F-12 applied filters, not stale form state or pagination. Use the existing authenticated request/session handling for the download; check HTTP status and CSV content type before creating the file, and release the temporary object URL afterward. Use a labeled button; prevent duplicate download requests while pending, and show a recoverable error without clearing filters. Students do not see the control and cannot export by calling the API directly.

## 3. Acceptance criteria

| AC | Given / when / then | Requirements |
| --- | --- | --- |
| AC-13.1 | Given a Supervisor assigned to teams A and A2 but not B, when they export active filters, then the CSV contains exactly the matching milestone IDs in the same order as all Overview pages, with matching states and no B rows. | FR-25, BR-02, DEC-05 |
| AC-13.2 | Given no grade, a draft-only grade, a published grade of 0, and a newer unpublished draft, when a Supervisor exports, then only published values are present and 0 is retained. | FR-25, BR-15, DEC-06 |
| AC-13.3 | Unauthorized and invalid inputs produce the same errors as F-12 where applicable; no error returns CSV or unrelated team information. Empty exports have a header, and an oversized result gives a clear error rather than a partial file. | BR-02, NFR-03, NFR-05, DEC-10 |
| AC-13.4 | CSV opens with readable Thai and correct columns for names containing commas, quotes and newlines. Formula-like user text is stored as text, not interpreted as a spreadsheet formula. | FR-25 |
| AC-13.5 | A Supervisor can download from the filtered view without losing filters on failure; the Student view does not expose a download button. | FR-25, NFR-10 |

## 4. Software Test Specification (planned)

| Test ID | AC | Level | Setup and action | Expected |
| --- | --- | --- | --- | --- |
| TEST-13.1i | 13.1 | API + PostgreSQL | Create A/A2/B and at least 51 matched milestones; use the F-12 filters separately and together, including repeated `state` plus `team`. Parse the CSV and compare to all F-12 pages at a fixed clock. | Same ordered milestone IDs and `window`, submission and feedback states; no B row; match count equals Overview total, not 50. |
| TEST-13.2i | 13.2 | API + PostgreSQL | Seed absent and draft-only grades, published 0, and a published score with a newer draft. Export. | Only published scores are present; blank for absent/unreleased; `grade_released` and `grade_score` agree. |
| TEST-13.3i | 13.3 | API + PostgreSQL | Add export to F-02 auth registry. Call as anonymous, Student, wrong-team Supervisor; compare unknown/unsupervised team, invalid filter and empty result. | Fixed `401`, `403`, masked identical `404` and field `400` JSON without attachment; header-only CSV on legitimate empty result. |
| TEST-13.3u | 13.3 | Unit | Exercise boundary using 10,000 and 10,001 matching rows at the service boundary. | Exact count returned at cap; above cap `400 VALIDATION_ERROR` with `fields.filters`, no CSV body or attachment. |
| TEST-13.4u | 13.4 | Unit | Serialize Thai, comma/quote/newline, formula-like names and titles, whitespace/control variants and numeric zero; parse with a CSV reader. | Fixed headers, BOM/CRLF, exact field counts, prefix only in qualifying `team_name` and `milestone_title` cells, unchanged numeric zero. |
| TEST-13.5c | 13.5 | Component | Exercise delayed success, failed response and filter changes in Overview for each role. | Only current applied filters sent; button disabled while pending; downloadable CSV on success only; failure retains filters and supports Retry; no Student control. |
| TEST-13.1e | 13.1, 13.5 | Browser | Supervisor applies a filter and captures the real browser download, parses it, then compares milestone IDs with Overview. | Real filename, header, ordered records and published grade correct. No extra team or wrong-state rows. |

## 5. Definition of Done

- [ ] Teammate reviews the contract before implementation; published-only export and explicit refusal above the limit are agreed in the PR #97 review.
- [ ] For Final Delivery, reuse implemented F-12 filters/scope and F-10 grade projection; commit tests before behavior and record RED/GREEN with actual commands, commit IDs and counts. No schema changes expected.
- [ ] Review into `staging/sprint-3`, then release through a reviewed PR. Verify a real deployed filtered download with synthetic data and record the release tag and check separately from CI.

Drafted with OpenAI Codex assistance. All tests in this contract are planned, not executed. No export code or deployment proof is part of the D2 contract work.
