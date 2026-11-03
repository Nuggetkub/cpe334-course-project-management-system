# F-01 Authentication and session — Engineering Contract

**Issue:** #6 · **Branch:** `feature/F-01-auth` · **Sprint:** 1 · **Owner:** @Nuggetkub · **Reviewer:** @Earth2509
**Requirements:** FR-01, FR-02, FR-03, FR-04 · NFR-01, NFR-02 (auth endpoints), NFR-04, NFR-05, NFR-10 (Login form)
**Decisions:** DEC-07 (one role per account), DEC-12 (DB sessions, `/api/auth/*`, kit smoke test) · **Traceability:** [traceability.md](../../traceability.md)

| Version | Date | Author | Reviewer | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-03 | @Nuggetkub | @Earth2509 | Contract committed before implementation |

---

## 1. Feature design

### 1.1 Behaviour

A seeded user signs in with email and password. The server checks the bcrypt hash, creates a
**session** row and returns an opaque **Bearer token** together with the user's identity and role.
The client sends `Authorization: Bearer <token>` on every protected request. `GET /api/auth/me`
returns the current user; `POST /api/auth/logout` deletes the session so the same token is rejected
immediately. A session expires 8 hours after login (NFR-04) and is never extended.

Why an opaque DB-backed token rather than a JWT or a cookie (DEC-12):
- Logout must invalidate the token **on the server** (FR-02, NFR-04). A DB row can be deleted; a JWT
  cannot be revoked without a deny-list.
- Cloud Run runs up to 3 stateless instances: state must live in PostgreSQL, not in memory.
- The Lab 5 kit smoke test (`deploy/smoke_test.py`) expects exactly this contract:
  `POST /api/auth/login` → `{ token }`, then `/api/auth/me` and `/api/auth/logout` with a Bearer header.

### 1.2 Workflow

```
Login page ──POST /api/auth/login {email,password}──► validate input ─✗─► 400 VALIDATION_ERROR
                                                         │✓
                                                   find user by email (normalised)
                                                   bcrypt.compare (dummy hash if no user)
                                                         │✗──────────────────────► 401 INVALID_CREDENTIALS
                                                         │✓
                                                   token = 32 random bytes (base64url)
                                                   INSERT session(token_hash = SHA-256(token), expires_at = now + 8 h)
                                                         ▼
                              200 { token, user } ◄──────┘
Client stores token (sessionStorage) → GET /api/auth/me → role navigation (Student | Supervisor)
Logout button → POST /api/auth/logout → DELETE session → 204 → client clears token → Login page
```

### 1.3 Dependencies

| Depends on | Why | State |
|---|---|---|
| Scaffold (#5) | Express app, Prisma, `users` table (`id`, `email`, `name`, `role`, `password_hash`) | Merged |
| F-03.1 (#8) | Seeded demo accounts for manual/E2E use | In progress — **not blocking**: API tests create their own users |
| — | F-02, F-03.2, F-04… depend on F-01's `requireAuth` middleware and `req.user` | Provided by this feature |

### 1.4 Business rules, validation and boundaries

| Rule | Detail |
|---|---|
| Email | Required; trimmed and lower-cased before lookup; must match `^[^\s@]+@[^\s@]+\.[^\s@]+$`; ≤ 254 chars |
| Password | Required; 1–128 chars; never trimmed, logged or returned |
| Wrong password / unknown email | Same status (401), same code, same message — no account enumeration. An unknown email still runs one `bcrypt.compare` against a fixed dummy hash so response time does not reveal it either |
| Password storage (NFR-01) | bcrypt, cost from `BCRYPT_COST` (default 12, rejected below 10). Helper `hashPassword()` is exported for the F-03.1 seed |
| Token | 32 bytes from `crypto.randomBytes`, base64url (43 chars). Only `SHA-256(token)` is stored, so a DB leak does not leak usable tokens |
| Expiry (NFR-04) | `expires_at = created_at + 8 h`, fixed at login. A request is valid while `now < expires_at`; at `now ≥ expires_at` it is rejected and the row is deleted |
| Logout | Deletes only the presented session (other sessions of the same user stay valid). Logging out with an already-invalid token → 401 |
| Header format | Exactly `Authorization: Bearer <token>`; missing, other scheme, empty or unknown token → 401 |
| Clock | Server clock only (AS-02); the client never computes expiry |

**Out of scope (disclosed):** login rate limiting / lockout, "remember me", password change or
reset (EX-01), multiple roles per account (EX-02). Rate limiting is listed as a known limitation in
the D1 report.

### 1.5 Permissions

| Endpoint | Unauthenticated | Student | Supervisor |
|---|---|---|---|
| `POST /api/auth/login` | Allowed | Allowed | Allowed |
| `GET /api/auth/me` | 401 | Own identity | Own identity |
| `POST /api/auth/logout` | 401 | Own session | Own session |

Role/ownership checks on domain endpoints belong to F-02; F-01 provides `req.user = { id, role }`.

---

## 2. Layer specifications

### 2.1 API

All errors use the NFR-05 shape (SR-01). F-01 introduces it and converts the scaffold's existing
`404`/`500` responses to it:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Check the highlighted fields.", "fields": { "email": "Enter a valid email address." } } }
```
`fields` is present only for `VALIDATION_ERROR`. No response ever contains a stack trace, SQL, a
password or a password hash.

| Method + path | Request | Success | Errors |
|---|---|---|---|
| `POST /api/auth/login` | `{ "email": string, "password": string }` | **200** `{ "token": "<43 chars>", "user": { "id": 1, "name": "…", "email": "…", "role": "STUDENT" \| "SUPERVISOR" } }` | **400** `VALIDATION_ERROR` (with `fields`) · **401** `INVALID_CREDENTIALS` "Email or password is incorrect" |
| `GET /api/auth/me` | Header `Authorization: Bearer <token>` | **200** `{ "user": { id, name, email, role } }` | **401** `UNAUTHENTICATED` "Sign in to continue" |
| `POST /api/auth/logout` | Header `Authorization: Bearer <token>`; body ignored | **204** (no body) | **401** `UNAUTHENTICATED` |

Shared middleware `requireAuth` (used by every later protected endpoint): reads the header, hashes
the token, loads a non-expired session with its user, sets `req.user`, else responds 401
`UNAUTHENTICATED`.

### 2.2 Data

Additive migration `add_sessions` (no change to existing columns — safe for Cloud Run rollback):

| Table `sessions` | Type | Constraint |
|---|---|---|
| `id` | serial | PK |
| `token_hash` | text | unique, not null — SHA-256 hex of the token |
| `user_id` | int | FK → `users.id`, `ON DELETE CASCADE`, indexed |
| `created_at` | timestamp(3) | default now() |
| `expires_at` | timestamp(3) | not null |

`users` is unchanged. Expired rows are deleted when presented; no background job in Sprint 1.

### 2.3 UI

| Element | Behaviour |
|---|---|
| `/login` page | Email and password fields, **Sign in** button (disabled while the request is in flight, label "Signing in…") |
| Client validation (AC-01.8) | Empty or malformed email → "Enter a valid email address."; empty password → "Enter your password." Shown under the field; no request sent |
| 401 (AC-01.8) | Banner "Email or password is incorrect" — identical for both cases |
| 5xx / network (AC-01.9) | Banner "Could not sign in. Please try again."; email kept, password cleared, button re-enabled |
| After login (AC-01.7) | Token saved in `sessionStorage`; header shows user name, role and **Log out**. Student nav: *My team*, *Milestones*. Supervisor nav: *My teams*, *Milestones*. Pages are placeholders until F-03.2/F-04 |
| Protected routes | Without a token, or when `/me` returns 401 (expired/logged out), the app clears the token and redirects to `/login` |
| Log out | Calls logout, clears the token even if the call fails, returns to `/login` |

Token storage choice: `sessionStorage` (cleared when the tab closes) rather than `localStorage`. Both
are readable by injected script, so the mitigation is React's default escaping and no
`dangerouslySetInnerHTML`; the server-side 8 h expiry and logout limit the damage of a stolen token.
Client routing uses `react-router-dom`.

### 2.4 Configuration

| Variable | Default | Purpose |
|---|---|---|
| `BCRYPT_COST` | `12` | bcrypt work factor; startup fails if < 10 (NFR-01) |
| `SESSION_TTL_HOURS` | `8` | Session lifetime (NFR-04); tests override the clock, not this value |

Both are added to `server/.env.example`.

---

## 3. Acceptance criteria

IDs are fixed in [traceability.md](../../traceability.md).

| AC | Given / When | Then (observable) | Req |
|---|---|---|---|
| AC-01.1 | A user exists; valid email + password are posted (email in any letter case, surrounding spaces) | 200 with `token` and `user {id,name,email,role}`; exactly one new `sessions` row for that user with `expires_at = created_at + 8 h` | FR-01 |
| AC-01.2 | Wrong password for an existing email, **or** an email that does not exist | 401 `INVALID_CREDENTIALS`, identical body in both cases; no session row created | FR-01, NFR-05 |
| AC-01.3 | A valid token | `GET /api/auth/me` → 200 with the same user as at login; no password fields | FR-03 |
| AC-01.4 | Logged in, then `POST /api/auth/logout` | 204; the session row is gone; the same token on `/me` → 401 | FR-02, NFR-04 |
| AC-01.5 | A session created at T | Accepted at T + 8 h − 1 s; rejected (401) at T + 8 h and at T + 8 h + 1 s | NFR-04 |
| AC-01.6 | Any user created through `hashPassword` | `password_hash` matches `^\$2[aby]\$(\d\d)\$` with cost ≥ 10; no API response body contains `password` or `passwordHash` | NFR-01 |
| AC-01.7 | Signed in as Student / as Supervisor | The matching navigation is shown with the user's name; **Log out** returns to `/login`, and reloading a protected page then redirects to `/login` | FR-04 |
| AC-01.8 | Login form: empty/malformed email, empty password; then a wrong password | Field messages appear and no request is sent; after the 401 the banner "Email or password is incorrect" appears | FR-01, NFR-10 |
| AC-01.9 | Login request fails with 5xx or a network error | Banner "Could not sign in. Please try again."; email kept, password cleared, user can retry | FR-01, NFR-10 |

Also covered here for the auth endpoints (completed by F-02 for every protected endpoint):
AC-02.1 — `/me` and `/logout` without a valid token → 401, no data. AC-SR1.1 — every error above uses
the NFR-05 shape.

---

## 4. Software Test Specification

Levels: **U** = unit (Vitest, no DB) · **I** = API + DB integration (Vitest + Supertest, isolated
`cpms_test` schema) · **C** = client component (Vitest + Testing Library) · **E** = end-to-end
(Playwright, real API + DB). Test titles start with the TEST ID.

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-01.1 | AC-01.1 | I | Student created with password `Corr3ct-horse` | `POST /api/auth/login` with `"  Student@Example.TEST "` + password | 200; `token` is 43 chars; `user` has id, name, email (lower-case), role `STUDENT`; one session row with `token_hash ≠ token` and `expires_at − created_at = 8 h` |
| TEST-01.2a | AC-01.2 | I | Same user | Login with wrong password | 401 `{error:{code:"INVALID_CREDENTIALS",message:"Email or password is incorrect"}}`; session count unchanged |
| TEST-01.2b | AC-01.2 | I | No such user | Login with `nobody@example.test` | Body identical to TEST-01.2a |
| TEST-01.2c | AC-01.2, AC-SR1.1 | I | — | Login with `{}`, with `email:"not-an-email"`, with a 129-char password | 400 `VALIDATION_ERROR` with `fields.email` / `fields.password` |
| TEST-01.3 | AC-01.3 | I | Logged in | `GET /api/auth/me` with Bearer token | 200 `{user}` equal to the login `user` |
| TEST-01.4 | AC-01.4 | I | Logged in | `POST /api/auth/logout`, then `GET /me` with the same token | 204 with empty body; session row deleted; then 401 `UNAUTHENTICATED` |
| TEST-01.4b | AC-01.4 | I | Two sessions for one user | Log out session A | Session B still works on `/me` |
| TEST-01.5a | AC-01.5 | U | `created = 2026-11-08T00:00:00Z` | `computeExpiry(created)`, `isExpired(expiry, now)` at −1 s, 0, +1 s | Expiry `08:00:00Z`; not expired / expired / expired |
| TEST-01.5b | AC-01.5 | I | Session row with `expires_at` 1 s in the past | `GET /me` | 401; the row is deleted |
| TEST-01.6a | AC-01.6 | U | — | `hashPassword("x")` with `BCRYPT_COST=10` and default | Hash matches bcrypt pattern with cost 10 / 12; `verifyPassword` true for right, false for wrong; cost 9 throws |
| TEST-01.6b | AC-01.6 | I | Logged in | Inspect the JSON of login and `/me` responses (recursively) | No key named `password` or `passwordHash` |
| TEST-01.7a | AC-01.7 | C | `/me` mocked as Student, then Supervisor | Render the app shell | Student sees *My team*/*Milestones*; Supervisor sees *My teams*/*Milestones*; both see name and **Log out** |
| TEST-01.7b | AC-01.7 | E | Student created in the E2E schema | Sign in through the form → check nav → **Log out** → open `/milestones` | Student nav shown; after logout `/login` is shown and `/milestones` redirects to `/login` |
| TEST-01.8a | AC-01.8 | C | Login page, `fetch` spied | Submit empty form; then malformed email | Both field messages shown; `fetch` not called |
| TEST-01.8b | AC-01.8 | C | `fetch` returns 401 | Submit valid-looking credentials | Banner "Email or password is incorrect" |
| TEST-01.9 | AC-01.9 | C | `fetch` returns 500, then rejects (network) | Submit | Banner "Could not sign in. Please try again."; email value kept; password empty; button enabled |
| TEST-02.1-auth | AC-02.1 | I | — | `GET /me` and `POST /logout` with no header, `Basic xyz`, `Bearer ` (empty), `Bearer unknown` | 401 `UNAUTHENTICATED` each; body has no user data |
| TEST-SR1.1-auth | AC-SR1.1 | I | — | Unknown `/api/x` (404), malformed JSON body on login (400) | `{error:{code,message}}`; no `stack`, no SQL text |

**TDD evidence:** commit order on this branch is (1) this contract, (2) failing tests TEST-01.x
(red run recorded in the PR), (3) implementation (green run). Rule-heavy tests (01.2, 01.4, 01.5)
must be seen failing before the code exists.

---

## 5. Definition of Done

- [ ] Behaviour in §1–§2 implemented in API, DB (additive migration) and UI.
- [ ] Every test in §4 exists, was seen **failing before** its implementation, and passes; red and
      green runs (command, counts, commit SHA) are in the PR.
- [ ] `server`: `npm run typecheck`, `npm test`; `client`: `npm test`, `npm run build`; root:
      `npm run e2e` — all pass on the PR head. No test skipped, disabled or weakened.
- [ ] `server/.env.example` and README updated (`BCRYPT_COST`, `SESSION_TTL_HOURS`, how to sign in).
- [ ] No password, hash or token in logs, responses (except the login `token`), commits or screenshots.
- [ ] Kit smoke-test contract holds: login → `{token}`, `/me` and `/logout` with Bearer.
- [ ] Reviewed and approved by @Earth2509 with a specific check recorded; merged into `staging/sprint-1`.
- [ ] Traceability and this contract updated if anything changed (new version row with the reason);
      known limitations (no rate limiting) disclosed.
