#!/usr/bin/env bash
# D-09 / NFR-12: proves that scripts/secret-scan.sh FAILS on a seeded fake secret
# and passes on clean content, without leaking the value into the log.
#
# The fake secrets are generated at runtime in a temporary folder. They are random,
# belong to no account, and are never written into the repository.
#
# HOW TO RUN (repo root, Linux x64, needs bash, curl, tar, sha256sum):
#   bash scripts/secret-scan.test.sh
# Prints `PASS: <case>` per case; any `FAIL ...` exits non-zero. CI runs it
# (.github/workflows/ci-docker.yml) before scanning the repository history.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAN="$ROOT/scripts/secret-scan.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail() { echo "FAIL: $*"; exit 1; }

random_alnum() { LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$1"; }

# run_case <name> <dir> <expected exit> [rule id that must be reported]
run_case() {
  local name="$1" dir="$2" expected="$3" rule="${4:-}" status=0
  bash "$SCAN" dir "$dir" >"$WORK/$name.log" 2>&1 || status=$?
  [ "$status" -eq "$expected" ] || { cat "$WORK/$name.log"; fail "$name: exit $status, expected $expected"; }
  if [ -n "$rule" ]; then
    grep -q "$rule" "$WORK/$name.log" || { cat "$WORK/$name.log"; fail "$name: rule $rule not reported"; }
  fi
  echo "PASS: $name"
}

# 1. clean content -> exit 0
mkdir -p "$WORK/clean"
printf 'DATABASE_URL is read from the environment.\nNo secret here.\n' >"$WORK/clean/README.txt"
run_case clean "$WORK/clean" 0

# 2. a fake GitHub personal access token -> exit 1, rule github-pat
TOKEN="ghp_$(random_alnum 36)"
mkdir -p "$WORK/token"
printf 'const token = "%s";\n' "$TOKEN" >"$WORK/token/config.ts"
run_case seeded-token "$WORK/token" 1 github-pat
# the log must not contain the value (the scan runs with --redact)
if grep -qF "$TOKEN" "$WORK/seeded-token.log"; then fail "seeded-token: the secret value was printed"; fi
echo "PASS: seeded-token is redacted in the log"

# 3. a fake private key block -> exit 1, rule private-key
mkdir -p "$WORK/key"
{
  echo "-----BEGIN RSA PRIVATE KEY-----"
  for _ in 1 2 3 4; do random_alnum 64; echo; done
  echo "-----END RSA PRIVATE KEY-----"
} >"$WORK/key/id_rsa"
run_case seeded-key "$WORK/key" 1 private-key

# 4. a scanner error is not a pass and not a finding -> exit 2
run_case missing-dir "$WORK/does-not-exist" 2

echo "All secret-scan checks passed."
