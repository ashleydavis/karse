#!/usr/bin/env bash
set -euo pipefail

# test.sh — run the e2e suite (scripts/e2e-tests.sh) N times at once to reproduce
# and diagnose parallel-run problems. Each run can execute from the main repo or
# from its own throwaway git worktree.
#
# Run with no arguments to print help.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKTREE_BASE="$PROJECT_ROOT/worktrees"
WORKTREE_PREFIX="parallel-e2e"

usage() {
    cat <<EOF
parallel-e2e.sh — run the e2e suite many times in parallel

USAGE
    scripts/parallel-e2e/test.sh                         show this help
    scripts/parallel-e2e/test.sh test [count] [where] [options]
    scripts/parallel-e2e/test.sh clean                   remove leftover $WORKTREE_PREFIX-* worktrees

TEST ARGUMENTS
    count            how many runs to launch at once (integer >= 1, default 2)
    where            'main' to run every copy from the main repo (default),
                     'worktree' (or 'worktrees') to give each run its own git worktree

OPTIONS (flags may be used instead of / alongside the positional args)
    -n, --count N    same as the positional count
    --main           run from the main repo (default)
    --worktrees      give each run its own git worktree under worktrees/
    --keep           in worktree mode, keep the worktrees after the run (default: remove)
    -h, --help       show this help

EXAMPLES
    scripts/parallel-e2e/test.sh test 2                  2 parallel runs from the main repo
    scripts/parallel-e2e/test.sh test 2 worktree         2 parallel runs, each in its own worktree
    scripts/parallel-e2e/test.sh test 10 worktree        ramp up: 10 parallel worktree runs
    scripts/parallel-e2e/test.sh test --count 100 --worktrees --keep

NOTES
    - Each run gets its own log under logs/parallel-e2e/<timestamp>/run-<i>.log .
      Tail one while a run is in flight: tail -f logs/parallel-e2e/<timestamp>/run-1.log
    - The exit code is 0 only if every run passed.
    - Worktree mode isolates everything per run (including e2e/test-results), which is
      the cleanest way to test true parallelism. Main mode is faster to start but all
      runs share project/e2e/test-results, which can itself cause collisions.
    - A hard kill can leave orphaned kwok clusters. Clean them with: bun run reap
EOF
}

die() { echo "parallel-e2e.sh: $*" >&2; exit 1; }

# ── Argument parsing ──────────────────────────────────────────────────────────
[[ $# -eq 0 ]] && { usage; exit 0; }

cmd="$1"; shift
case "$cmd" in
    -h|--help|help) usage; exit 0 ;;
    clean) ;;
    test) ;;
    *) echo "parallel-e2e.sh: unknown command '$cmd'" >&2; echo >&2; usage; exit 1 ;;
esac

if [[ "$cmd" == "clean" ]]; then
    echo "Removing $WORKTREE_PREFIX-* worktrees..."
    found=0
    while IFS= read -r line; do
        wt="${line#worktree }"
        case "$(basename "$wt")" in
            "$WORKTREE_PREFIX"-*)
                echo "  removing $wt"
                git -C "$PROJECT_ROOT" worktree remove --force "$wt" 2>/dev/null || true
                found=1
                ;;
        esac
    done < <(git -C "$PROJECT_ROOT" worktree list --porcelain | grep '^worktree ')
    git -C "$PROJECT_ROOT" worktree prune
    [[ "$found" -eq 0 ]] && echo "  none found"
    echo "Done."
    exit 0
fi

# Defaults for the test command.
COUNT=2
MODE=main          # main | worktree
KEEP_WORKTREES=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--count) [[ $# -ge 2 ]] || die "--count needs a value"; COUNT="$2"; shift 2 ;;
        --main) MODE=main; shift ;;
        --worktree|--worktrees) MODE=worktree; shift ;;
        --keep) KEEP_WORKTREES=1; shift ;;
        -h|--help) usage; exit 0 ;;
        main) MODE=main; shift ;;
        worktree|worktrees) MODE=worktree; shift ;;
        ''|*[!0-9]*) die "unexpected argument '$1' (see: scripts/parallel-e2e/test.sh)" ;;
        *) COUNT="$1"; shift ;;   # bare integer = count
    esac
done

[[ "$COUNT" =~ ^[0-9]+$ ]] || die "count must be an integer, got '$COUNT'"
[[ "$COUNT" -ge 1 ]] || die "count must be >= 1"

# ── Preflight ─────────────────────────────────────────────────────────────────
[[ -f "$PROJECT_ROOT/scripts/e2e-tests.sh" ]] || die "scripts/e2e-tests.sh not found under $PROJECT_ROOT"
command -v git >/dev/null 2>&1 || die "git is required"
command -v bun >/dev/null 2>&1 || die "bun is required"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$PROJECT_ROOT/logs/parallel-e2e/$TIMESTAMP"
mkdir -p "$LOG_DIR"

echo "parallel-e2e: count=$COUNT mode=$MODE"
echo "parallel-e2e: logs -> $LOG_DIR"

CREATED_WORKTREES=()
PIDS=()

cleanup() {
    trap - INT TERM EXIT
    echo
    echo "parallel-e2e: cleaning up..."
    for pid in "${PIDS[@]:-}"; do
        [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
    done
    # Give child e2e runs a moment to tear down their own clusters.
    sleep 2
    if [[ "$MODE" == "worktree" && "$KEEP_WORKTREES" -eq 0 ]]; then
        for wt in "${CREATED_WORKTREES[@]:-}"; do
            [[ -n "$wt" ]] || continue
            git -C "$PROJECT_ROOT" worktree remove --force "$wt" 2>/dev/null || true
        done
        git -C "$PROJECT_ROOT" worktree prune 2>/dev/null || true
    fi
}

# ── One run ───────────────────────────────────────────────────────────────────
# Runs in the background. Writes "<exit-code> <seconds>" to run-<i>.result so the
# parent can build a summary without relying on `wait`'s exit code alone.
run_one() {
    local i="$1" workdir="$2"
    local log="$LOG_DIR/run-$i.log"
    local start end ec
    start="$(date +%s)"
    if run_inner "$i" "$workdir" >"$log" 2>&1; then ec=0; else ec=$?; fi
    end="$(date +%s)"
    printf '%s %s\n' "$ec" "$((end - start))" > "$LOG_DIR/run-$i.result"
}

run_inner() {
    local i="$1" workdir="$2"
    cd "$workdir"
    if [[ "$MODE" == "worktree" ]]; then
        echo "[run $i] bun install in $workdir"
        bun install
    fi
    echo "[run $i] starting scripts/e2e-tests.sh in $workdir"
    bash scripts/e2e-tests.sh
}

# ── Worktree setup (serial: git worktree add contends on the index lock) ───────
declare -a WORKDIRS
if [[ "$MODE" == "worktree" ]]; then
    REF="$(git -C "$PROJECT_ROOT" rev-parse HEAD)"
    mkdir -p "$WORKTREE_BASE"
    for i in $(seq 1 "$COUNT"); do
        wt="$WORKTREE_BASE/$WORKTREE_PREFIX-$i"
        if [[ -e "$wt" ]]; then
            git -C "$PROJECT_ROOT" worktree remove --force "$wt" 2>/dev/null || true
            rm -rf "$wt"
        fi
        echo "parallel-e2e: creating worktree $wt"
        git -C "$PROJECT_ROOT" worktree add --detach "$wt" "$REF" >/dev/null
        CREATED_WORKTREES+=("$wt")
        WORKDIRS[$i]="$wt"
    done
else
    for i in $(seq 1 "$COUNT"); do
        WORKDIRS[$i]="$PROJECT_ROOT"
    done
fi

trap cleanup INT TERM

# ── Launch ────────────────────────────────────────────────────────────────────
echo "parallel-e2e: launching $COUNT run(s)..."
for i in $(seq 1 "$COUNT"); do
    run_one "$i" "${WORKDIRS[$i]}" &
    PIDS+=($!)
done

echo "parallel-e2e: $COUNT run(s) in flight. Tail a log to watch progress, e.g.:"
echo "  tail -f $LOG_DIR/run-1.log"

# Wait for everyone. Don't let a failing run trip set -e here.
for pid in "${PIDS[@]}"; do
    wait "$pid" || true
done

trap - INT TERM

# ── Summary ───────────────────────────────────────────────────────────────────
echo
echo "================ RESULTS (mode=$MODE, count=$COUNT) ================"
passed=0
for i in $(seq 1 "$COUNT"); do
    result_file="$LOG_DIR/run-$i.result"
    if [[ -f "$result_file" ]]; then
        read -r ec secs < "$result_file"
    else
        ec=1; secs="?"
    fi
    if [[ "$ec" == "0" ]]; then
        status="PASS"; passed=$((passed + 1))
    else
        status="FAIL (exit $ec)"
    fi
    printf '  run %-4s %-14s %5ss   %s\n' "$i" "$status" "$secs" "$LOG_DIR/run-$i.log"
done
echo "-------------------------------------------------------------------"
echo "  passed $passed / $COUNT"
echo "==================================================================="

# Teardown worktrees (unless asked to keep them).
if [[ "$MODE" == "worktree" && "$KEEP_WORKTREES" -eq 0 ]]; then
    echo "parallel-e2e: removing worktrees (pass --keep to retain)..."
    for wt in "${CREATED_WORKTREES[@]:-}"; do
        [[ -n "$wt" ]] || continue
        git -C "$PROJECT_ROOT" worktree remove --force "$wt" 2>/dev/null || true
    done
    git -C "$PROJECT_ROOT" worktree prune 2>/dev/null || true
elif [[ "$MODE" == "worktree" ]]; then
    echo "parallel-e2e: worktrees kept under $WORKTREE_BASE/$WORKTREE_PREFIX-* (remove with: scripts/parallel-e2e/test.sh clean)"
fi

[[ "$passed" -eq "$COUNT" ]] && exit 0 || exit 1
