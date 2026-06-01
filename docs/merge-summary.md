# Branch integration summary

All Todo-item feature branches have been integrated into `main`. Each was verified green, merged with `--no-ff`, had its conflicts resolved, re-verified green, committed, and deleted. `main` is green on the full suite.

## Final state

- **Final `bun run tests:all` on `main`: exit 0.**
  - compile: clean (backend, frontend, e2e)
  - unit (Jest): 14 suites, 173 tests passed
  - smoke: all passed (kwok)
  - e2e (Playwright + kwok): 171 passed
- No feature/fix/refactor branches remain; all merged and deleted.
- Tests now run the backend/Vite on OS-assigned free ports (item 14), so they no longer collide with a running dev server.

## Items merged (first-parent order)

| # | Item | Branch | Merge commit |
|---|------|--------|--------------|
| 1 | Raw YAML view | `feature/raw-yaml-view` | `1f1e5bb` |
| 2 | Guided commands | `feature/guided-commands` | `531d77b` |
| 3 | Multi-container pods | `feature/multi-container-pods` | `e09b453` |
| 4 | Pod detail tabs | `feature/pod-detail-tabs` | `1826b57` |
| 6 | Filter pods by phase | `feature/pod-phase-filter` | `1b0e902` |
| 7 | Breadcrumbs | `feature/breadcrumbs` | `922c948` |
| 8 | Shareable URL state | `feature/shareable-url-state` | `0009ecc` |
| 9 | Nav-bar dropdown pickers | `feature/navbar-dropdown-pickers` | `264c502` |
| 10 | Stern multi-pod live logs | `feature/stern-live-logs` | `3f6932e` |
| 11 | Table hover consistency | `fix/table-hover-consistency` | `b8d7d28` |
| 12 | Single-pod live (follow) logs | `feature/live-pod-logs` | `8af1553` |
| 13 | Events view | `feature/event-log` | `e03094c` |
| 14 | Random free ports in tests | `fix/test-random-ports` | `1f8651f` |
| 15 | Remove setGlobalMutation kludge | `refactor/remove-setglobalmutation-kludge` | `217834f` |
| 16 | Node detail lists its pods | `feature/node-pods-list` | `c375d36` |
| 17 | Fuzzy table search | `feature/fuzzy-search` | `20b8b18` |
| 18 | Fix mixed node status test | `fix/mixed-node-status-test` | `c6b208e` |

Item 5 (`feature/pod-auto-load-logs`) was dropped at your request (force-deleted, not merged).

## Notable conflict resolutions and fixes during integration

- **Pod detail page** ended up combining several features: tabs (item 4), YAML + Commands buttons (items 1/2), shareable back-navigation (item 8), and the Live logs toggle (item 12).
- **Streaming de-duplication (item 12):** item 10 and item 12 each added their own `streamPodLogs`/streaming helper. Collapsed to one implementation (item 10's), with item 12's single-pod Live toggle rewired onto it. No duplicate exports; adapter stays read-only.
- **`pods-table` re-render bug (post item 6 + item 1):** the phase filter pre-filtered a fresh array each render, which rebuilt react-table's row model and detached the YAML button mid-click. Fixed by giving react-table the stable `data.pods` reference and filtering via its own `columnFilters` + `filterFn` (no `useMemo`).
- **Shareable URL redirect (item 8):** the index route dropped the query string on `/` → `/cluster`; fixed with an `IndexRedirect` that preserves `search`.
- **Dynamic test ports (item 14):** reconciled `smoke-tests.sh`/`e2e-tests.sh` so every check targets the discovered port (no hardcoded `:5172`), while keeping the full superset of checks.
- **`kube-context` provider (item 15):** integrated the two kubeconfig-write mutations into item 8's URL-backed provider rather than reverting it.
- **Fuzzy search (item 17):** fixed two real bugs on the branch (separator handling so `ng-x` matches `nginx-...`; per-cell matching so a query can't span unrelated columns).
- **Mixed node status (item 18):** combined item 14's dynamic ports with item 18's selective kwok node management (`--manage-all-nodes=false` + annotation selector) so a genuinely NotReady node persists; removed the old e2e interception workaround.
- **`PodContainersPanel` hover (item 11):** carried the `tableRowSx` hover styling into the panel where the container tables now live post-tabs.
- **Manual-testing scenarios:** each branch independently reused scenario number `17` (and a few others); renumbered on merge to unique numbers. Current scenarios run 01–29 (e.g. `17-raw-yaml-view` … `27-live-pod-logs`, `28-events-view`, `29-fuzzy-search`).

## Process notes

- Each branch was merged by a dedicated sub agent that verified `bun run tests:all` green on the branch, merged, resolved conflicts, and re-verified green before committing — no merge was committed without a green full suite.
- `e2e/src/e2e.test.ts` was repeatedly an interleaved-conflict tangle; resolved by reconstructing (main's full file + the branch's new describe blocks appended before the final close).
- Nothing was pushed. `main` is ahead of `origin/main` with all the above; review and push when ready.
