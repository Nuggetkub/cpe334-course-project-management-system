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
#
# The PEM header of the fake key is assembled at runtime, so this file itself
# contains nothing the private-key rule matches.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAN="$ROOT/scripts/secret-scan.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail() { echo "FAIL: $*"; exit 1; }

# `tr` gets SIGPIPE when `head` has enough bytes; that is expected, so it must not trip pipefail.
random_alnum() { { LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom 2>/dev/null || true; } | head -c "$1"; }

# run_case <name> <mode> <path> <expected exit> [rule id that must be reported]
run_case() {
  local name="$1" mode="$2" path="$3" expected="$4" rule="${5:-}" status=0
  bash "$SCAN" "$mode" "$path" >"$WORK/$name.log" 2>&1 || status=$?
  [ "$status" -eq "$expected" ] || { cat "$WORK/$name.log"; fail "$name: exit $status, expected $expected"; }
  if [ -n "$rule" ]; then
    grep -q "$rule" "$WORK/$name.log" || { cat "$WORK/$name.log"; fail "$name: rule $rule not reported"; }
  fi
  echo "PASS: $name"
}

write_fake_key() {  # <file>: a PEM block with random content; the header is assembled here
  local kind="PRIVATE"
  { echo "-----BEGIN RSA $kind KEY-----"
    for _ in 1 2 3 4; do random_alnum 64; echo; done
    echo "-----END RSA $kind KEY-----"; } >"$1"
}

commit_all() {  # <repo> <message>: a disposable repository with a neutral identity
  git -C "$1" add -A
  git -C "$1" -c user.name="secret-scan test" -c user.email="test@example.invalid" \
    -c commit.gpgsign=false commit -q -m "$2"
}

new_repo() { mkdir -p "$1"; git -C "$1" init -q; }

# --- dir mode ------------------------------------------------------------------
# 1. clean content -> exit 0
mkdir -p "$WORK/clean"
printf 'DATABASE_URL is read from the environment.\nNo secret here.\n' >"$WORK/clean/README.txt"
run_case clean dir "$WORK/clean" 0

# 2. a fake GitHub personal access token -> exit 1, rule github-pat, value not printed
TOKEN="ghp_$(random_alnum 36)"
mkdir -p "$WORK/token"
printf 'const token = "%s";\n' "$TOKEN" >"$WORK/token/config.ts"
run_case seeded-token dir "$WORK/token" 1 github-pat
if grep -qF "$TOKEN" "$WORK/seeded-token.log"; then fail "seeded-token: the secret value was printed"; fi
echo "PASS: seeded-token is redacted in the log"

# 3. a fake private key block -> exit 1, rule private-key
mkdir -p "$WORK/key"
write_fake_key "$WORK/key/id_rsa"
run_case seeded-key dir "$WORK/key" 1 private-key

# 4. a scanner error is not a pass and not a finding -> exit 2
run_case missing-dir dir "$WORK/does-not-exist" 2

# --- git mode (the mode the CI gate uses) ----------------------------------------
# 5. a clean history -> exit 0
new_repo "$WORK/git-clean"
printf 'hello\n' >"$WORK/git-clean/README.md"
commit_all "$WORK/git-clean" "clean"
run_case git-clean git "$WORK/git-clean" 0

# 6. a fake token committed, then deleted -> still found in the history, with its commit
new_repo "$WORK/git-token"
TOKEN2="ghp_$(random_alnum 36)"
printf 'const token = "%s";\n' "$TOKEN2" >"$WORK/git-token/config.ts"
commit_all "$WORK/git-token" "add token"
rm "$WORK/git-token/config.ts"
commit_all "$WORK/git-token" "remove token"
run_case git-token git "$WORK/git-token" 1 github-pat
grep -q "commit [0-9a-f]\{7\}" "$WORK/git-token.log" || fail "git-token: commit not reported"
if grep -qF "$TOKEN2" "$WORK/git-token.log"; then fail "git-token: the secret value was printed"; fi
if grep -q "example.invalid\|secret-scan test" "$WORK/git-token.log"; then fail "git-token: author data was printed"; fi
echo "PASS: git-token reports the commit without the value or the author"

# 7. the reviewed exception is one historical finding, not the whole file:
#    a new key committed at the same path is still found
new_repo "$WORK/git-samepath"
mkdir -p "$WORK/git-samepath/scripts"
write_fake_key "$WORK/git-samepath/scripts/secret-scan.test.sh"
commit_all "$WORK/git-samepath" "key at the allowlisted path"
run_case git-samepath git "$WORK/git-samepath" 1 private-key

# --- the scanner binary ----------------------------------------------------------
# 8. an executable planted where a shared cache would be is never run
mkdir -p "$WORK/shared/gitleaks-8.30.1"
printf '#!/bin/sh\ntouch "%s"\nexit 0\n' "$WORK/planted-ran" >"$WORK/shared/gitleaks-8.30.1/gitleaks"
chmod +x "$WORK/shared/gitleaks-8.30.1/gitleaks"
status=0
RUNNER_TEMP="$WORK/shared" TMPDIR="$WORK/shared" bash "$SCAN" dir "$WORK/token" >"$WORK/planted.log" 2>&1 || status=$?
[ ! -e "$WORK/planted-ran" ] || fail "planted: a pre-existing executable was run"
[ "$status" -eq 1 ] || { cat "$WORK/planted.log"; fail "planted: exit $status, expected 1"; }
echo "PASS: planted executable ignored; the verified scanner found the token"

echo "All secret-scan checks passed."
