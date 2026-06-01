# Todo resolution summary

Each item from the "Todo" section of `readme.md` was resolved on its own branch off `main`
by a dedicated sub agent. Branches are committed but **not pushed**. Inspect each branch before
merging. Several branches touch overlapping files (see "Cross-branch notes" at the end), so the
merge order will matter and some manual conflict resolution is expected.

| # | Item | Branch |
|---|------|--------|
| 1 | Number manual testing guide sequentially | `number-manual-testing-guide` |
| 2 | YAML on a sub tab of the resource page | `yaml-on-sub-tab` |
| 3 | Fix blank page for Deployment/StatefulSet/DaemonSet drill-down | `fix-workload-detail-blank-page` |
| 4 | Separate Containers / Init Containers tabs under Pods | `pod-init-containers-tab` |
| 5 | Ensure fake pod logs still work for testing | `verify-fake-pod-logs` |
| 6 | Colocate page components under per-page subdirectories | `colocate-page-components` |
| 7 | Fix automatic updating of pod logs | `fix-auto-updating-pod-logs` |
| 8 | Breadcrumbs in the navbar with current sub tab | `breadcrumbs-in-navbar` |
| 9 | Stop routing every icon through the font-awesome file | `simplify-icon-imports` |
| 10 | Random ports for backend/frontend when testing | `remove-resolved-test-ports-todo` |
| 11 | YAML on a separate tab instead of a button | `yaml-separate-tab` |
| 12 | Arrow pointing at the button for dropdown pickers | `dropdown-picker-arrow` |
| 13 | Register created clusters and auto-teardown in test setup | `register-test-clusters-teardown` |
| 14 | Rename "Live Logs" to "Logs" | `rename-live-logs-to-logs` |
| 15 | Confirm live logs work with a real cluster | `confirm-live-logs-real-cluster` |
| 16 | Fix coding style in header.tsx (one-line if bodies) | `fix-header-coding-style` |
| 17 | Auto-load and auto-update logs with a refresh button | `auto-load-logs` |
| 18 | Add a Stern page using `stern` for live logs | `stern-logs-page` |
| 19 | Add Status/Details, Pods, Events tabs to the Node page | `node-page-tabs` |
| 20 | Add an Errors page linked from the sidebar bottom | `errors-page` |
| 21 | Add missing unit tests for fuzzy-filter.ts and others | `add-missing-unit-tests` |

---

## 1. Number manual testing guide sequentially
**Item:** "Make sure the docs in the manual testing guide are numbered sequentially."
**Done:** The KWOK scenario directories (`01-`..`29-`) and the index table were already sequential, but the `# Scenario N:` heading inside 9 scenario READMEs (dirs 18-26) had drifted, producing duplicates/gaps. Corrected those headings so all 29 titles match their directory numbers. Docs-only change; full suite (173 backend tests) still passes.
**Branch:** `number-manual-testing-guide`
**Caveats:** None.

## 2. YAML on a sub tab of the resource page
**Item:** "Yaml should be displayed on a sub tab of the resource page."
**Done:** YAML was shown via a header button opening a modal. Extracted a shared `YamlPanel`, added a "YAML" tab to the pod detail page, and introduced Detail/Status + YAML tabs on the node detail page. Per-row list YAML buttons kept (list views, not detail pages). e2e coverage added; `bun run tests:all` green.
**Branch:** `yaml-on-sub-tab`
**Caveats:** Overlaps heavily with item 11 (`yaml-separate-tab`) since both target the YAML-button-to-tab change off `main`. Merge one, then reconcile the other.

## 3. Fix blank page for workload drill-down
**Item:** "Drilling down into a Deployment, Statefulset, or Daemonset shows a blank page. Drilling down into Pods is ok."
**Done:** Root cause: tables linked to `/<kind>/:ns/:name` but `app.tsx` had no routes and no detail components for those kinds, so React Router rendered nothing. Added `getWorkloadDetail` (read-only) to the backend, a workloads detail route, shared types, an api-client function, and a shared `WorkloadDetailPage` (details/stats, selector, selected pods, labels, events) plus the three routes. Backend + e2e + smoke tests added; `bun run tests:all` green.
**Branch:** `fix-workload-detail-blank-page`
**Caveats:** Adds a `30-workload-detail-pages` manual-testing scenario (see cross-branch note about the `30-` name collision).

## 4. Separate Containers / Init Containers tabs
**Item:** "Maybe separate tabs under Pods for Containers and Init Containers."
**Done:** Split the combined containers panel into `PodContainersPanel` (regular) and `PodInitContainersPanel` (init). Pod detail now has a separate "Init Containers" tab, rendered only when the pod has init containers (falls back to Containers otherwise). e2e tests added for both the has-init and no-init cases; suite green.
**Branch:** `pod-init-containers-tab`
**Caveats:** None. (Noted a pre-existing stale "30 tests" figure in `docs/development.md`, left unchanged.)

## 5. Ensure fake pod logs still work
**Item:** "Be sure that the fake pod logs still work for testing when enabled."
**Done:** Verified the `KARSE_FAKE_LOGS=1` path (canned logs for `getPodLogs`, line-by-line emit for `streamPodLogs`) works and is wired into dev/smoke/e2e. Nothing was broken; added regression tests for the previously-untested deferred-close and `stop()`-cancellation lifecycle. Suite green.
**Branch:** `verify-fake-pod-logs`
**Caveats:** None.

## 6. Colocate page components
**Item:** "Components for each page should be under a subdirectory for that page... Eg pages/pod/index.tsx && pages/pod/components/..."
**Done:** Restructured `frontend/src/pages/` so each page is `pages/<page>/index.tsx` with a local `components/` subdir for page-only components (every page covered: cluster-home, contexts, daemonsets, deployments, errors, events, live-logs, namespaces, node-detail, nodes, pod-detail, pods, statefulsets, stern, workload-detail). 15 page moves plus 12 page-only component moves, all via `git mv` so history is preserved. Components shared across multiple pages (the app shell, header, sidebar, breadcrumbs, context/namespace pickers, and the `yaml-dialog` and `commands-dialog`) kept in `frontend/src/components/`. All imports updated; `tsc` clean; full suite green. Done as a standalone change against the current code so no page was left partial or inconsistent.
**Caveats:** Behavior unchanged (pure refactor).

## 7. Fix automatic updating of pod logs
**Item:** "Automatic updating pod logs didn't work."
**Done:** Root cause: in fake-logs mode the backend dumped the backlog and closed immediately, so the stream behaved like a one-shot fetch (auto-update never exercised); also the frontend treated a deliberate close as a real error. Fixed the fake stream to keep emitting `seq=N` lines every 250ms until stopped, and added a clean-close flag so deliberate closes do not raise spurious disconnect errors. Backend + e2e + smoke tests added; suite green.
**Branch:** `fix-auto-updating-pod-logs`
**Caveats:** Overlaps with item 17 (`auto-load-logs`) in the same logs area.

## 8. Breadcrumbs in the navbar
**Item:** "Breadcrumbs need to be in the navbar... include the current tab under Pods... main page big (title sized) text, sub pages regular size."
**Done:** Moved breadcrumbs into the header/navbar (removed the in-body breadcrumb bar and the old page-title). First crumb renders at title size, the rest at normal size. The pod detail active tab is now driven by a `tab` URL search param so the breadcrumb can show it (and links are shareable). Added `tab` to shareable nav state. e2e updated; suite green.
**Branch:** `breadcrumbs-in-navbar`
**Caveats:** Removing `getPageTitle` here also removes the one-line-if code that item 16 targets, so resolving both may leave item 16 with nothing to change after this merges. Overlaps with items 4/7/17 (pod detail tab state).

## 9. Stop routing every icon through the font-awesome file
**Item:** "Why does every icon need to go through the font-awesome file?"
**Done:** The file used Font Awesome's global `library.add(...)` registry pattern (icons referenced by string name), forcing every icon through one file and losing compile-time checking + tree-shaking. Converted all 21 files to import icon objects directly, deleted `lib/font-awesome.ts`, and moved the still-needed CSS import + `config.autoAddCss = false` into `main.tsx`. `tsc` now type-checks icon usage; e2e green.
**Branch:** `simplify-icon-imports`
**Caveats:** Deletes `lib/font-awesome.ts`. Branches that register a new icon there (items 17, 18, 20) will conflict; after merging this, those need their icons imported directly instead.

## 10. Random ports for backend/frontend when testing
**Item:** "Really need to choose random ports for be/fe when testing."
**Done:** The feature was already implemented and merged on `main` previously (`KARSE_PORT=0` free-port selection threaded through backend, smoke/e2e scripts, Vite proxy, and Playwright, with tests). Only a stale readme Todo line remained; removed it. `bun run tests:all` green.
**Branch:** `remove-resolved-test-ports-todo`
**Caveats:** No code change needed; this branch is essentially just the readme cleanup. Could be dropped if you prefer to clear the readme line another way.

## 11. YAML on a separate tab instead of a button
**Item:** "The Yaml needs to be on a separate tab, rather than having a button."
**Done:** Same intent as item 2, resolved independently off `main`. Added a `YamlPanel`, a YAML tab on pod and node detail pages, removed the detail-page YAML buttons. Per-row table YAML buttons (deployments/statefulsets/daemonsets/namespaces have no detail page) kept as dialogs. e2e added; suite green.
**Branch:** `yaml-separate-tab`
**Caveats:** Duplicate of item 2. Pick one branch (`yaml-on-sub-tab` or `yaml-separate-tab`) to merge; do not merge both.

## 12. Arrow on dropdown pickers
**Item:** "Be nice if the dropdown pickers had an arrow pointing at the button."
**Done:** Added a shared `QuickPickerPopover` that anchors to the trigger button and draws a CSS beak/arrow pointing at it, and refactored the context and namespace quick pickers to use it for consistency. e2e tests assert the arrow-bearing paper position; suite green.
**Branch:** `dropdown-picker-arrow`
**Caveats:** Required one documented typed cast to forward `data-test-id` through MUI's paper slot props.

## 13. Register created clusters and auto-teardown
**Item:** "...register what clusters were created so that we can have one script to tear down any testing setup. Also... tear down should be an automatic first step in setup."
**Done:** Added `docs/manual-testing/kwok/lib.sh` providing a registry file (`~/.karse-test-clusters`), `karse_create_cluster` (registers then creates), `teardown_all_test_clusters` (deletes registered + reconciles against the `karse-test` prefix), and `setup_begin` (auto-teardown-first). Updated all 29 scenario setup/teardown scripts and `teardown-all.sh` to use it. Added a stubbed-`kwokctl` self-test (`scripts/test-kwok-lib.sh`) wired into `tests:all` as a `test:scripts` step and into CI. Suite green.
**Branch:** `register-test-clusters-teardown`
**Caveats:** Large diff (66 files) across every scenario script.

## 14. Rename "Live Logs" to "Logs"
**Item:** "Live Logs can just be called logs."
**Done:** Label-only rename (sidebar, header title, page heading, breadcrumb references, docs). Route was already `/logs`, so no path change. Internal identifiers (`data-test-id`s, `LiveLogsPage` filename, scenario dir) intentionally left unchanged. e2e updated; suite green.
**Branch:** `rename-live-logs-to-logs`
**Caveats:** Overlaps with items 8/17 (header/logs) on user-facing label strings.

## 15. Confirm live logs work with a real cluster
**Item:** "Need to confirm that live logs works with a real cluster."
**Done:** No real cluster was reachable in the environment (docker-desktop API down, no kind/minikube, KWOK produces no real logs), so end-to-end was **not** verified. Audited the real path and found + fixed a genuine bug: `command-runner` merged kubectl stderr into stdout and ignored the exit code, so real `kubectl logs -f` failures showed as ordinary log lines and never raised an error. Added an `onStderr` callback and made `streamPodLogs` surface non-zero exits (not caused by `stop()`) via `onError`. Added a real-cluster manual-testing scenario (`docs/manual-testing/real-cluster/01-live-pod-logs`) with a busybox log generator, and 6 backend tests. Suite green.
**Branch:** `confirm-live-logs-real-cluster`
**Caveats:** **End-to-end behavior against a real cluster remains unverified and must be confirmed by a human** running the new scenario. The error-surfacing relies on `kubectl logs -f` exiting non-zero on failure (standard).

## 16. Fix coding style in header.tsx
**Item:** "The coding style hasn't been followed in header.tsx. If statement body is on one line after the curly brackets."
**Done:** Per the project style (braces around all conditional bodies, one statement per line, Allman `else`), rewrote the 15 brace-less one-line `if (...) return` statements in `getPageTitle` and split a two-statement `onClick`. Pure formatting, behavior unchanged. e2e (which already covers page titles + color-mode menu) green.
**Branch:** `fix-header-coding-style`
**Caveats:** Item 8 deletes `getPageTitle` entirely. If item 8 merges first, this branch may become a no-op; if this merges first, item 8 removes the code anyway. Reconcile accordingly.

## 17. Auto-load and auto-update logs with a refresh button
**Item:** "Auto load logs when looking at logs. Remove the button to load/stream logs... Have a refresh button... By default logs should automatically update..."
**Done:** Pod logs tab: the "Live" follow toggle now defaults on, so logs stream immediately on open; Refresh restarts the stream/re-fetches. Logs page: removed the manual Stream/Stop buttons, stream opens automatically on open and on scope change, added a Refresh button and a default-on Live toggle. Dropped now-unused play/stop icons. e2e updated; suite green.
**Branch:** `auto-load-logs`
**Caveats:** Overlaps with items 7 (log streaming) and 14 (logs page). Touches `lib/font-awesome.ts` which item 9 deletes.

## 18. Add a Stern page using `stern`
**Item:** "...add a new page called Stern and actually use `stern` to show live logs (with filters/wildcards...). If `stern` isn't installed show the user how to install it."
**Done:** Added a read-only `stern-adapter` (`isSternAvailable` probes `stern --version`; `streamStern` spawns stern in follow mode via the command-runner), an SSE route `GET /api/stern/stream`, shared types, an api-client SSE function, a Stern page with namespace + query (wildcard/regex) controls mirroring the Logs page, and a sidebar nav entry. Not-installed case emits an `unavailable` SSE event and the page shows install instructions (brew/krew/manual). Added `KARSE_FAKE_STERN=1` fake mode (analogous to fake logs) used by smoke/e2e. Backend + route + smoke + e2e tests added; suite green.
**Branch:** `stern-logs-page`
**Caveats:** Touches `lib/font-awesome.ts` (icon registration) which item 9 deletes; also adds a sidebar entry (item 20 also edits the sidebar).

## 19. Node page tabs
**Item:** "Make sure the Node page has tabs: Status / Details, Pods, Events."
**Done:** Restructured the node detail page into MUI tabs: Status/Details (existing panels), Pods (pods on the node, click-through), and Events. Added node-event fetching to `getNodeDetail` (read-only, `involvedObject.kind=Node,involvedObject.name=<node>`), extended the `NodeDetail` type with `events`. Backend + smoke + e2e + manual scenario added; suite green.
**Branch:** `node-page-tabs`
**Caveats:** Adds a `30-node-detail-tabs` manual-testing scenario (`30-` name collision, see cross-branch note). Also restructures the node detail page, overlapping with items 2/11 (which add a YAML tab there).

## 20. Errors page
**Item:** "I need to have an Errors page linked from the bottom of the left sidebar. This should show errors occurring in the cluster."
**Done:** Added a read-only `listClusterErrors` (merges Warning events with problem pods: CrashLoopBackOff, ImagePullBackOff, ErrImagePull, CreateContainerConfigError, Failed/Unknown, etc.), a `GET /api/errors` route, shared types, an api-client function, an Errors page with a sortable/filterable table, and a sidebar link pinned to a separate bottom nav list. Backend + smoke + e2e + manual scenario added; suite green.
**Branch:** `errors-page`
**Caveats:** Adds a `30-errors-view` manual-testing scenario (`30-` name collision). Touches the sidebar (overlaps item 18) and `lib/font-awesome.ts` (item 9 deletes it).

## 21. Add missing unit tests
**Item:** "No unit tests appear to have been created for fuzzy-filter.ts. Check all other TS files for functions that can be unit tested but are not, then write unit tests for them."
**Done:** Set up Jest + `@swc/jest` for the frontend workspace (mirroring the backend config), wired into `tests:all`. Added 28 tests for `fuzzy-filter.ts` (`fuzzyMatch`, `fuzzyGlobalFilter`) and 11 for `guided-commands.ts` (`buildGuidedCommands`). Audited the rest: backend already fully covered, types file is declarations only, other frontend lib files are side-effecting/integration-tested, components are out of policy. Narrowed the documented policy so pure lib utilities are now unit-tested. Suite green (173 backend + 39 new frontend + smoke + e2e).
**Branch:** `add-missing-unit-tests`
**Caveats:** Introduces a new frontend unit-test runner and devDependencies; if item 6 (`colocate-page-components`) merges, the lib file paths are unaffected (lib was not moved), but double-check the test glob.

---

## Cross-branch notes (for merge planning)

- **Duplicate work:** items 2 (`yaml-on-sub-tab`) and 11 (`yaml-separate-tab`) implement the same YAML-tab change. Merge only one.
- **`lib/font-awesome.ts` deletion:** item 9 deletes this file. Items 17, 18, and 20 add icon registrations to it. After merging item 9, those branches must import icon objects directly instead of registering them.
- **Sidebar edits:** items 18 (Stern nav) and 20 (Errors bottom nav) both edit `sidebar.tsx`.
- **Node detail page:** items 2/11 (YAML tab) and 19 (Status/Pods/Events tabs) both restructure it.
- **Pod detail / logs:** items 4 (init tab), 7 (auto-update), 8 (tab-in-URL), 17 (auto-load) all touch the pod detail/logs area.
- **header.tsx:** item 8 removes `getPageTitle`, which is exactly what item 16 reformats. Reconcile.
- **Large structural branch:** item 6 moves ~23 page/component files. Plan its merge order against the other frontend branches deliberately.
- **Manual-testing scenario `30-` collision:** items 3, 19, and 20 each add a new scenario numbered `30-` (`30-workload-detail-pages`, `30-node-detail-tabs`, `30-errors-view`). Renumber to `30/31/32` as they merge.
- **Real-cluster verification:** item 15's end-to-end confirmation still requires a human run against a real cluster.

Every branch reported `bun run tests:all` passing in isolation off `main`. Because the branches were
developed independently off `main`, the test counts differ between reports and the suites have not been
run against the combined/merged result; re-run `bun run tests:all` after each merge.
