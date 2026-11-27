#!/usr/bin/env bash
# D-09 / NFR-12: scan for committed secrets with gitleaks (pinned, checksum-verified).
#
# USAGE (Linux x64, as in CI):
#   bash scripts/secret-scan.sh git <repo>   # every commit in the history (needs a full clone)
#   bash scripts/secret-scan.sh dir <path>   # the files under <path>
#
# EXIT CODES
#   0  no secret found
#   1  a secret was found (rule and file are printed; the value is redacted)
#   2  the scan could not run (bad arguments, missing path, download or checksum failure)
#
# Findings are printed as rule, file, line and commit only, read from a redacted JSON
# report: no secret value and no author name or email reaches the CI log.
# The scanner is downloaded into a fresh private folder (mktemp -d) on every run and
# verified against the pinned SHA-256 there, so no pre-existing executable is ever run.
# A reviewed false positive is listed by its exact fingerprint (commit:file:rule:line) in
# .gitleaksignore, with a comment; never by path or rule alone, and never by switching
# the step off.
set -uo pipefail

VERSION="8.30.1"
SHA256="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"  # gitleaks_8.30.1_linux_x64.tar.gz
URL="https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_linux_x64.tar.gz"
LEAKS_EXIT=3   # gitleaks' exit code for "found leaks"; distinct from its own error exit (1)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
error() { echo "secret-scan: $*" >&2; exit 2; }

mode="${1:-}"; target="${2:-}"
case "$mode" in git|dir) ;; *) error "usage: secret-scan.sh git|dir <path>" ;; esac
[ -n "$target" ] && [ -e "$target" ] || error "path not found: ${target:-<none>}"
[ "$(uname -s)-$(uname -m)" = "Linux-x86_64" ] || error "only Linux x64 is supported (CI runner)"

BIN_DIR="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/gitleaks.XXXXXXXX")" || error "cannot create a private folder"
trap 'rm -rf "$BIN_DIR"' EXIT
BIN="$BIN_DIR/gitleaks"
curl -fsSL --retry 3 -o "$BIN_DIR/gitleaks.tar.gz" "$URL" || error "download failed"
echo "$SHA256  $BIN_DIR/gitleaks.tar.gz" | sha256sum -c --quiet - || error "checksum mismatch for gitleaks ${VERSION}"
tar -xzf "$BIN_DIR/gitleaks.tar.gz" -C "$BIN_DIR" gitleaks || error "cannot unpack gitleaks"

REPORT="$BIN_DIR/report.json"
args=(--redact --no-banner --exit-code "$LEAKS_EXIT" --report-format json --report-path "$REPORT"
      --gitleaks-ignore-path "$ROOT/.gitleaksignore")

status=0
"$BIN" "$mode" "${args[@]}" "$target" || status=$?
case "$status" in
  0) echo "secret-scan: no secrets found ($mode $target)"; exit 0 ;;
  "$LEAKS_EXIT")
    jq -r '.[] | "finding: \(.RuleID)  \(.File):\(.StartLine)\(if .Commit != "" then "  commit \(.Commit[0:7])" else "" end)"' "$REPORT"       || error "cannot read the gitleaks report"
    echo "secret-scan: SECRET FOUND ($mode $target)" >&2; exit 1 ;;
  *) error "gitleaks failed with exit $status" ;;
esac
