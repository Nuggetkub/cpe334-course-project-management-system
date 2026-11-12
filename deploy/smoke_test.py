"""Public deployment checks. Credentials/tokens are never printed.

WHAT THIS SCRIPT DOES
    Called by .github/workflows/deploy.yml after a deployment:
        python3 deploy/smoke_test.py SERVICE_URL
    It checks the live service and exits non-zero (failing the workflow) if any
    check fails. Each public check is retried up to 5 times, 3 seconds apart, to
    tolerate Cloud Run cold starts.

    Checks (in order)
      1. GET /api/health      -> {"status": "ok"}
      2. GET /api/ready       -> {"db": "connected"}   (proves the DB works)
      3. GET /                -> HTML page (the built React app is served)
      4. POST /api/auth/login with an unknown account -> 401 INVALID_CREDENTIALS
         (the migrated users table is queried; nothing is created)
      5. OPTIONAL login test  -> login, /api/auth/me, logout. Runs only if BOTH
         env vars SMOKE_EMAIL and SMOKE_PASSWORD are set (set both or neither),
         e.g. smoke.student@example.test with the student demo password from
         Secret Manager (proves the --demo seed ran).
         The session is always logged out, even if a check fails.

IMPORTANT
    Uses only the Python standard library (no pip install needed).
    Offline unit tests: deploy/tests/test_smoke.py

REFERENCES
    - urllib.request : https://docs.python.org/3/library/urllib.request.html
    - unittest.mock  : https://docs.python.org/3/library/unittest.mock.html

CHANGE ME (groups using another tech stack):
    - the endpoint paths and expected responses in check() below
      (/api/health, /api/ready, /, /api/auth/*)
    - the login/logout endpoints and the 'token' field of the login response
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request


# --- HTTP helper --------------------------------------------------------------
# Returns the response body (bytes). Raises on HTTP errors / timeouts.
def request(base, path, data=None, token=None):
    headers = {}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(base + path, headers=headers,
        data=json.dumps(data).encode() if data is not None else None)
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


# Our API has no public data endpoint (the kit used /api/categories). A sign-in
# with an unknown account must get 401 INVALID_CREDENTIALS: login looks the email
# up in the migrated users table, so a missing table would give 500 instead.
# Read-only: no account or session is created.
UNKNOWN_LOGIN = {'email': 'smoke-check-unknown@example.invalid', 'password': 'smoke-check-only'}


def login_rejected(base):
    try:
        request(base, '/api/auth/login', UNKNOWN_LOGIN)
    except urllib.error.HTTPError as error:
        return error.code == 401 and json.loads(error.read()).get('error', {}).get('code') == 'INVALID_CREDENTIALS'
    return False


def check(base):
    # --- Public checks (CHANGE ME: paths + predicates for your own API) -------
    for path, probe in (
        ('/api/health', lambda: json.loads(request(base, '/api/health')).get('status') == 'ok'),
        ('/api/ready', lambda: json.loads(request(base, '/api/ready')).get('db') == 'connected'),
        ('/', lambda: b'<html' in request(base, '/').lower()),
        ('/api/auth/login (unknown account -> 401)', lambda: login_rejected(base)),
    ):
        # Retry: a cold Cloud Run instance may need a few seconds to start.
        for attempt in range(5):
            try:
                if not probe():
                    raise ValueError('Unexpected response')
                break
            except (urllib.error.URLError, TimeoutError, ValueError):
                if attempt == 4:
                    raise RuntimeError('Smoke check failed: ' + path) from None
                time.sleep(3)
        print('PASS ' + path)

    # --- Optional login check (only when both credentials are provided) -------
    email, password = os.getenv('SMOKE_EMAIL'), os.getenv('SMOKE_PASSWORD')
    if bool(email) != bool(password):
        raise RuntimeError('Set both SMOKE_EMAIL and SMOKE_PASSWORD, or neither.')
    if not email:
        print('SKIP login: optional smoke credentials not configured')
        return
    token = None
    try:
        login = json.loads(request(base, '/api/auth/login', {'email': email, 'password': password}))
        token = login['token']
        request(base, '/api/auth/me', token=token)
        print('PASS login and authenticated /api/auth/me')
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
        raise RuntimeError('Login smoke check failed') from None
    finally:
        # Always end the session, even when a check above failed.
        if token:
            request(base, '/api/auth/logout', data={}, token=token)
            print('PASS logout')


# --- Entry point ----------------------------------------------------------------
if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 deploy/smoke_test.py SERVICE_URL')
    check(sys.argv[1].rstrip('/'))
