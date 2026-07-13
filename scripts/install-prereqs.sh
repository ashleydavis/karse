#!/usr/bin/env bash
#
# Install the prerequisites Karse's tests need that are not language runtimes:
# right now that is kwokctl, pinned to KWOK_VERSION, installed into the repo's
# git-ignored bin/.
#
# Why not mise: mise's registry entry for kwokctl (aqua:kubernetes-sigs/kwok/kwokctl)
# downloads the WRONG release asset — it fetches kwok-<os>-<arch>, the kwok
# controller binary, and installs it under the name kwokctl. Every kwokctl command
# then fails with a baffling "unknown flag: --name". A kwok release ships two
# binaries (kwok and kwokctl); the test scripts only ever want kwokctl, so we take
# it straight from the release ourselves and verify we got the right one.
#
# The binary lands in <repo>/bin, which is git-ignored. Every script that shells out
# to kwokctl sources scripts/repo-bin.sh, which puts that directory on PATH, so the
# tests use this pinned copy rather than whatever the machine happens to have.
# CI runs this same script, so CI and local run the identical kwokctl.
#
# Idempotent: an already-installed, correct, matching-version kwokctl is left alone.
#
# Usage: bash scripts/install-prereqs.sh

set -euo pipefail

KWOK_VERSION="v0.7.0"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$REPO_ROOT/bin"

info() { printf '  %s\n' "$1"; }
warn() { printf 'WARN: %s\n' "$1" >&2; }
have() { command -v "$1" >/dev/null 2>&1; }

# The real kwokctl identifies itself as "kwokctl version ..."; the kwok controller
# binary says "kwok version ...". That difference is the whole point of this check:
# it is what catches a mis-packaged install (see the note above).
is_real_kwokctl() {
    [ -x "$1" ] && "$1" --version 2>/dev/null | grep -q '^kwokctl version'
}

kwokctl_version_matches() {
    "$1" --version 2>/dev/null | grep -q "^kwokctl version ${KWOK_VERSION} "
}

echo "Installing prerequisites:"

# --- kwokctl (pinned, repo-local) -----------------------------------------
if is_real_kwokctl "$BIN_DIR/kwokctl" && kwokctl_version_matches "$BIN_DIR/kwokctl"; then
    info "ok    kwokctl ${KWOK_VERSION} (bin/kwokctl)"
else
    have curl || { warn "curl is required to download kwokctl"; exit 1; }

    OS="$(uname | tr '[:upper:]' '[:lower:]')"                    # linux or darwin
    ARCH="$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')"   # amd64 or arm64
    URL="https://github.com/kubernetes-sigs/kwok/releases/download/${KWOK_VERSION}/kwokctl-${OS}-${ARCH}"

    info "installing kwokctl ${KWOK_VERSION} (${OS}-${ARCH}) into bin/"
    mkdir -p "$BIN_DIR"
    # Download to a temp name and only move it into place once it is verified, so a
    # failed or truncated download never leaves a broken kwokctl behind.
    curl -fsSL -o "$BIN_DIR/kwokctl.tmp" "$URL"
    chmod +x "$BIN_DIR/kwokctl.tmp"

    if ! is_real_kwokctl "$BIN_DIR/kwokctl.tmp"; then
        rm -f "$BIN_DIR/kwokctl.tmp"
        warn "downloaded binary from $URL is not kwokctl; nothing installed."
        exit 1
    fi

    mv "$BIN_DIR/kwokctl.tmp" "$BIN_DIR/kwokctl"
    info "ok    $("$BIN_DIR/kwokctl" --version)"
fi

# --- tools that must come from the machine --------------------------------
# These are not installed here: bun and kubectl are pinned in mise.toml (`mise install`),
# and jq/curl come from the system package manager. Report what is missing so a fresh
# clone finds out now rather than halfway through a test run.
missing=()
for tool in bun kubectl jq curl; do
    have "$tool" || missing+=("$tool")
done

if [ "${#missing[@]}" -gt 0 ]; then
    warn "not on PATH: ${missing[*]}"
    warn "bun and kubectl are pinned in mise.toml (run 'mise trust && mise install');"
    warn "install jq and curl with your system package manager."
else
    info "ok    bun, kubectl, jq, curl"
fi

echo "Done. The smoke, e2e, and fixture scripts pick up bin/kwokctl automatically."
echo "To use it in your own shell: export PATH=\"\$PWD/bin:\$PATH\""
