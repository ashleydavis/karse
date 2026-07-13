#!/usr/bin/env bash
#
# Put the repo's own bin/ on PATH, so every script that shells out to kwokctl runs the
# pinned copy scripts/install-prereqs.sh installed, never whatever the machine happens
# to have (or a mis-packaged one from a tool manager: see the note in install-prereqs.sh).
#
# Source it, do not execute it. Near the top of a script:
#
#   source "$(dirname "${BASH_SOURCE[0]}")/repo-bin.sh"
#
# The path is worked out from this file's own location, so it holds wherever the caller
# is run from and whatever the caller's working directory is.

__repo_bin_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATH="$__repo_bin_root/bin:$PATH"

# A ticket worktree is a separate checkout and bin/ is git-ignored, so a fresh worktree
# has no bin/ of its own. Fall back to the main checkout's bin/ (where install-prereqs.sh
# put kwokctl), so tests run from a worktree work without installing kwokctl per worktree.
__repo_bin_common="$(git -C "$__repo_bin_root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
if [ -n "$__repo_bin_common" ]; then
    __repo_bin_main="$(dirname "$__repo_bin_common")"
    if [ "$__repo_bin_main" != "$__repo_bin_root" ]; then
        PATH="$PATH:$__repo_bin_main/bin"
    fi
fi

export PATH
unset __repo_bin_root __repo_bin_common __repo_bin_main
