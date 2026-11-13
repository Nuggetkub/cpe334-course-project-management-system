#!/usr/bin/env bash
# Offline regression checks: every gcloud and openssl call is a local stub.
# ==============================================================================
# WHAT THIS TEST DOES (no real GCP calls, no cost)
#   Puts fake `gcloud` / `openssl` first on PATH and runs deploy/deploy.sh in
#   these scenarios, asserting on the recorded commands:
#     first_run : nothing exists      -> everything is created
#     rerun     : everything exists   -> nothing replaced (credentials kept)
#     partial   : DB secret missing   -> DB user password reset + secret created
#     job-fail  : migration fails     -> script exits 1, service NOT deployed
#     demo      : --demo flag         -> both demo secrets created, granted, given to the job
#     demo_rerun: --demo, all usable  -> no secret or DB password replaced
#     empty     : --demo, secrets exist without a version (interrupted run)
#                                     -> new versions added, DB password reset, nothing re-created
#     disabled  : --demo, :latest versions DISABLED -> same recovery as empty
#     denied    : secrets describe -> PERMISSION_DENIED  } exit 1; no SQL password
#     transient : versions list -> UNAVAILABLE           } change, no secret write,
#     transient_demo: only a demo secret's lookup fails  } no job or service deploy
#   It also checks: `--edition=enterprise` and `--no-storage-auto-increase`,
#   no admin secret (this app has no admin role), no project-wide secretAccessor role,
#   DB password == password inside DATABASE_URL, and that no password/secret
#   value leaks into the output. Finally DRY_RUN=1 must make zero gcloud calls.
#
# HOW TO RUN (repo root, needs bash):  bash deploy/tests/test_deploy_stub.sh
#   Prints `PASS: <scenario>` per scenario; any `FAIL ...` exits non-zero.
#   CI runs it too (.github/workflows/ci-docker.yml).
#
# ⭐ CHANGE ME: if you rename resources in deploy/deploy.sh (e.g. the secret
#    names cpms-database-url, cpms-student-demo-password,
#    cpms-supervisor-demo-password, the DB user `cpms`), update the matching
#    strings below.
# ==============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="${SCRIPT_DIR}/../deploy.sh"
export TEST_STATE_DIR
TEST_STATE_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_STATE_DIR"' EXIT
mkdir -p "$TEST_STATE_DIR/bin"

# --- Fake `openssl` (deterministic "random" values) ---------------------------
cat > "$TEST_STATE_DIR/bin/openssl" <<'STUB'
#!/usr/bin/env bash
if [ "$2" = "-hex" ]; then
  printf '%s\n' '0123456789abcdef0123456789abcdef0123456789abcdef'
else
  printf '%s\n' 'TESTONLYGENERATEDPASSWORD'
fi
STUB

# --- Fake `gcloud`: logs each call (password redacted), answers per $STUB_MODE
cat > "$TEST_STATE_DIR/bin/gcloud" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
redacted=()
for arg in "$@"; do
  case "$arg" in
    --password=*)
      printf '%s' "${arg#--password=}" > "$TEST_STATE_DIR/sql-pass"
      redacted+=("--password=<REDACTED>") ;;
    *) redacted+=("$arg") ;;
  esac
done
printf '%s\n' "${redacted[*]}" >> "$GCLOUD_LOG"
if [ "${1:-} ${2:-}" = 'config get-value' ]; then
  echo stub-gcp-project
  exit 0
fi
if [ "${1:-} ${2:-} ${3:-}" = 'run services describe' ]; then
  echo https://cpms-stub.example.invalid
  exit 0
fi
if [ "${1:-} ${2:-} ${3:-}" = 'run jobs execute' ]; then
  [ "$STUB_MODE" != job-fail ]
  exit $?
fi
if [ "${1:-} ${2:-}" = 'secrets describe' ]; then
  case "$STUB_MODE" in
    first_run) not_found=1 ;;
    partial) [ "${3:-}" = cpms-database-url ] && not_found=1 ;;
    denied)
      echo "ERROR: (gcloud.secrets.describe) PERMISSION_DENIED: Permission 'secretmanager.secrets.get' denied" >&2
      exit 1 ;;
  esac
  if [ -n "${not_found:-}" ]; then
    echo "ERROR: (gcloud.secrets.describe) NOT_FOUND: Secret [${3:-}] not found or has no versions." >&2
    exit 1
  fi
  exit 0
fi
if [ "${1:-} ${2:-} ${3:-}" = 'secrets versions list' ]; then
  # State of the newest version. empty = created but `versions add` never ran.
  case "$STUB_MODE" in
    empty) exit 0 ;;
    disabled) echo DISABLED; exit 0 ;;
    transient)
      echo "ERROR: (gcloud.secrets.versions.list) UNAVAILABLE: connection reset" >&2; exit 1 ;;
    transient_demo)
      if [ "${4:-}" = cpms-supervisor-demo-password ]; then
        echo "ERROR: (gcloud.secrets.versions.list) UNAVAILABLE: connection reset" >&2; exit 1
      fi ;;
  esac
  echo ENABLED
  exit 0
fi
if [ "${1:-} ${2:-} ${3:-}" = 'secrets versions add' ]; then
  cat > "$TEST_STATE_DIR/payload-${4}"
  exit 0
fi
if [ "${1:-} ${2:-} ${3:-}" = 'sql users list' ]; then
  if [ "$STUB_MODE" = first_run ]; then
    echo postgres
  else
    printf 'postgres\ncpms\n'
  fi
  exit 0
fi
for word in "$@"; do
  if [ "$word" = describe ]; then
    case "$STUB_MODE" in
      first_run) exit 1 ;;
      partial)
        if [ "${1:-} ${3:-}" = 'secrets cpms-database-url' ]; then
          exit 1
        fi ;;
    esac
  fi
done
STUB
chmod +x "$TEST_STATE_DIR/bin/openssl" "$TEST_STATE_DIR/bin/gcloud"
export PATH="$TEST_STATE_DIR/bin:$PATH"
export PROJECT_ID=stub-gcp-project
export REGION=asia-southeast1
export DRY_RUN=0

# --- Run every scenario and assert on what deploy.sh did ------------------------
for MODE in first_run rerun partial job-fail demo demo_rerun empty disabled denied transient transient_demo; do
  case "$MODE" in
    demo) export STUB_MODE=first_run ;;
    demo_rerun) export STUB_MODE=rerun ;;
    *) export STUB_MODE="$MODE" ;;
  esac
  export GCLOUD_LOG="$TEST_STATE_DIR/gcloud-$MODE.log"
  rm -f "$TEST_STATE_DIR/sql-pass" "$TEST_STATE_DIR"/payload-*
  args=()
  DEMO=0
  case "$MODE" in demo|demo_rerun|empty|disabled|denied|transient|transient_demo) DEMO=1; args+=(--demo) ;; esac
  result=0
  bash "$DEPLOY_SCRIPT" "${args[@]}" > "$TEST_STATE_DIR/output" 2>&1 || result=$?
  expected=0
  case "$MODE" in job-fail|denied|transient|transient_demo) expected=1 ;; esac
  if [ "$result" -ne "$expected" ]; then
    echo "FAIL $MODE: unexpected exit $result (wanted $expected)"
    exit 1
  fi
  case "$MODE" in denied|transient|transient_demo)
    # A failed Secret Manager lookup must stop the run before anything changes.
    if grep -Eq '^(sql users (create|set-password)|secrets (create|versions add)|run (deploy|jobs deploy)) ' "$GCLOUD_LOG"; then
      echo "FAIL $MODE: changed credentials or deployed after a failed secret lookup"; exit 1
    fi
    if ! grep -q 'no credential was changed' "$TEST_STATE_DIR/output"; then
      echo "FAIL $MODE: no clear error message"; exit 1
    fi
    echo "PASS: $MODE (failed lookup aborts, nothing changed)"
    continue ;;
  esac
  if [ "$MODE" = job-fail ]; then
    if grep -q '^run deploy ' "$GCLOUD_LOG"; then
      echo 'FAIL: service deployed after migration failure'; exit 1
    fi
  else
    grep -q '^run deploy ' "$GCLOUD_LOG"
  fi
  if grep -q '^projects add-iam-policy-binding .*roles/secretmanager.secretAccessor' "$GCLOUD_LOG"; then
    echo 'FAIL: runtime has project-wide secret access'; exit 1
  fi
  grep -q "^secrets add-iam-policy-binding cpms-database-url .*roles/secretmanager.secretAccessor" "$GCLOUD_LOG"
  if grep -qi 'admin-password\|ADMIN_PASSWORD' "$GCLOUD_LOG"; then
    echo 'FAIL: admin secret used, but this app has no admin role'; exit 1
  fi
  if [ "$DEMO" = 1 ]; then
    for secret in cpms-student-demo-password cpms-supervisor-demo-password; do
      grep -q "^secrets add-iam-policy-binding $secret .*roles/secretmanager.secretAccessor" "$GCLOUD_LOG"
    done
    grep -q '^run jobs deploy .*STUDENT_DEMO_PASSWORD=cpms-student-demo-password:latest,SUPERVISOR_DEMO_PASSWORD=cpms-supervisor-demo-password:latest' "$GCLOUD_LOG"
    grep -q '^run jobs deploy .*SEED_DEMO_DATA=true' "$GCLOUD_LOG"
  elif grep -q '^secrets add-iam-policy-binding cpms-[a-z]*-demo-password ' "$GCLOUD_LOG"; then
    echo 'FAIL: granted optional demo secret in non-demo mode'; exit 1
  fi
  # The service itself only ever gets the database URL.
  if grep '^run deploy ' "$GCLOUD_LOG" | grep -q 'DEMO_PASSWORD'; then
    echo 'FAIL: demo password given to the service'; exit 1
  fi
  case "$MODE" in
    first_run)
      grep -q -- '--edition=enterprise' "$GCLOUD_LOG"
      grep -q -- '--no-storage-auto-increase' "$GCLOUD_LOG"
      grep -q '^sql users create ' "$GCLOUD_LOG" ;;
    partial) grep -q '^sql users set-password ' "$GCLOUD_LOG" ;;
    rerun|demo_rerun)
      if grep -Eq '^(secrets create|secrets versions add|sql users (create|set-password)) ' "$GCLOUD_LOG"; then
        echo "FAIL $MODE: rerun replaced existing credentials"; exit 1
      fi ;;
    empty|disabled)
      # Retry after an interrupted run: the secrets exist but :latest is unusable.
      # The containers are reused, every secret gets a new version, and the DB
      # user's password is reset to the one stored in the new DATABASE_URL.
      if grep -q '^secrets create ' "$GCLOUD_LOG"; then
        echo "FAIL $MODE: re-created a secret that already exists"; exit 1
      fi
      for secret in cpms-database-url cpms-student-demo-password cpms-supervisor-demo-password; do
        if ! grep -q "^secrets versions add $secret " "$GCLOUD_LOG"; then
          echo "FAIL $MODE: no new version for $secret"; exit 1
        fi
      done
      grep -q '^sql users set-password ' "$GCLOUD_LOG" ;;
  esac
  if [ -f "$TEST_STATE_DIR/sql-pass" ]; then
    db_pass="$(cat "$TEST_STATE_DIR/sql-pass")"
    db_url="$(cat "$TEST_STATE_DIR/payload-cpms-database-url")"
    case "$db_url" in
      "postgresql://cpms:${db_pass}@"*) ;;
      *) echo 'FAIL: DB password differs from secret'; exit 1 ;;
    esac
    if grep -Fq "$db_pass" "$TEST_STATE_DIR/output"; then
      echo 'FAIL: DB password leaked to output'; exit 1
    fi
  fi
  for secret_file in "$TEST_STATE_DIR"/payload-*; do
    [ -f "$secret_file" ] || continue
    secret_value="$(cat "$secret_file")"
    if [ -n "$secret_value" ] && grep -Fq "$secret_value" "$TEST_STATE_DIR/output"; then
      echo 'FAIL: secret payload leaked to output'; exit 1
    fi
  done
  echo "PASS: $MODE (exit, migration gate, credential handling, secret redaction)"
done
# --- Dry run must not call gcloud at all ------------------------------------------
export GCLOUD_LOG="$TEST_STATE_DIR/dry-run-calls"
DRY_RUN=1 bash "$DEPLOY_SCRIPT" --demo > "$TEST_STATE_DIR/dry-run-output"
if [ -f "$GCLOUD_LOG" ]; then
  echo 'FAIL: dry run called gcloud'; exit 1
fi
echo 'PASS: dry run makes no gcloud calls'
