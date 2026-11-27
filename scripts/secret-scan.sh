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
# The findings are printed with --redact, so a real secret never reaches the CI log.
# A false positive is handled in .gitleaks.toml with a reviewed, commented allowlist,
# never by switching the step off.
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

BIN_DIR="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/gitleaks-${VERSION}"
BIN="$BIN_DIR/gitleaks"
if [ ! -x "$BIN" ]; then
  mkdir -p "$BIN_DIR" || error "cannot create $BIN_DIR"
  curl -fsSL --retry 3 -o "$BIN_DIR/gitleaks.tar.gz" "$URL" || error "download failed"
  echo "$SHA256  $BIN_DIR/gitleaks.tar.gz" | sha256sum -c --quiet - || error "checksum mismatch for gitleaks ${VERSION}"
  tar -xzf "$BIN_DIR/gitleaks.tar.gz" -C "$BIN_DIR" gitleaks || error "cannot unpack gitleaks"
fi

args=(--redact --no-banner --verbose --exit-code "$LEAKS_EXIT")
[ -f "$ROOT/.gitleaks.toml" ] && args+=(--config "$ROOT/.gitleaks.toml")

status=0
"$BIN" "$mode" "${args[@]}" "$target" || status=$?
case "$status" in
  0) echo "secret-scan: no secrets found ($mode $target)"; exit 0 ;;
  "$LEAKS_EXIT") echo "secret-scan: SECRET FOUND ($mode $target); see the redacted findings above" >&2; exit 1 ;;
  *) error "gitleaks failed with exit $status" ;;
esac
