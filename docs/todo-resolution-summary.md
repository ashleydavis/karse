# Todo resolution summary

Each Todo item from `readme.md` was resolved on its own branch by a dedicated sub agent, working sequentially off a clean `main`. Each branch contains the feature plus tests and a manual-testing doc, and was committed (not pushed). Per-branch gates run before each commit were: `bun run compile`, `bun run test` (Jest), and `bun run smoke`. The heavy kwok-backed `bun run e2e` was not executed per the run instruction, but all e2e test code compiles and follows existing patterns. Inspect each branch and merge as you see fit.

## Items and branches

| # | Todo item | Branch | Gates |
|---|-----------|--------|-------|
| 1 | See raw YAML for every viewable resource | `feature/raw-yaml-view` | compile/test/smoke green |
| 2 | Guided commands ("delete this pod" style guidance) | `feature/guided-commands` | compile/test/smoke green |
| 3 | Multi-container pods (count in list + drill-down) | `feature/multi-container-pods` | compile/test/smoke green |
| 4 | Pod detail tabs (Detail/Status, Containers, Logs) | `feature/pod-detail-tabs` | compile/test/smoke green |
| 5 | Auto-load logs on the pod page | `feature/pod-auto-load-logs` | compile/test/smoke green |
| 6 | Filter pods by phase (dropdown with checkboxes) | `feature/pod-phase-filter` | compile/test/smoke green |
| 7 | Breadcrumbs | `feature/breadcrumbs` | compile/test/smoke green |
| 8 | Shareable URL state (context/namespace/page/resource) | `feature/shareable-url-state` | compile/test/smoke green |
| 9 | Pickers drop down from nav bar (not modals) | `feature/navbar-dropdown-pickers` | compile/test/smoke green |
| 10 | Stern-style multi-pod live logs | `feature/stern-live-logs` | compile/test/smoke green |
| 11 | Consistent table row hover effect | `fix/table-hover-consistency` | compile/test/smoke green |
| 12 | Live (follow) single-pod logs | `feature/live-pod-logs` | compile/test/smoke green |
| 13 | Event log (cluster/namespace Events view) | `feature/event-log` | compile/test/smoke green |
| 14 | Run be/fe on random free ports in tests | `fix/test-random-ports` | compile/test/smoke green |
| 15 | Remove `setGlobalMutation` kludge | `refactor/remove-setglobalmutation-kludge` | compile/test/smoke green |
| 16 | Each node shows the pods running on it | `feature/node-pods-list` | compile/test/smoke green |
| 17 | Fuzzy match for searching pods/resources | `feature/fuzzy-search` | compile/test/smoke green |
| 18 | Fix the mixed node status test (kwok) | `fix/mixed-node-status-test` | compile/test/smoke green |

## What was done per item

### 1. Raw YAML view (`feature/raw-yaml-view`)
A generic "YAML" button + dialog to view raw YAML for all six viewable resource types (nodes, pods, deployments, daemonsets, statefulsets, namespaces). Backend `getResourceYaml` + `isYamlResourceType` in `kubectl-adapter.ts` (whitelisted `get <kind> <name> [-n ns] -o yaml` via the audit-logging `kubectl()` helper, type whitelist blocks arbitrary reads), exposed through `routes/yaml-route.ts`. Frontend `yaml-dialog.tsx` wired into all tables, the namespace list, and pod/node detail pages. Read-only invariant preserved.
- Note: this item already had substantial uncommitted work in the tree at session start; the agent validated, completed, and committed it.

### 2. Guided commands (`feature/guided-commands`)
Read-only "guided commands": for a resource, Karse displays the relevant `kubectl` command strings the user could run themselves (describe/logs/exec/delete/scale/cordon/etc.), each with a copy-to-clipboard button and an explicit note that Karse never executes them. Pure frontend `lib/guided-commands.ts` builder + `commands-dialog.tsx`; surfaced on the pod and node detail pages. No adapter changes (preserves the read-only invariant).

### 3. Multi-container pods (`feature/multi-container-pods`)
Added a `containerCount` to the `Pod` type and a sortable "Containers" column to the pods table (derived from `.spec.containers`). The pod detail page already rendered full per-container info (name, image, state, ready, restarts) plus an init-containers table and per-container log selector. Refactored the duplicated pod-list mapping in `kubectl-adapter.ts` into a shared `mapPodListItem` helper.

### 4. Pod detail tabs (`feature/pod-detail-tabs`)
Reorganized the pod detail page into three MUI Tabs: "Detail / Status" (details, labels, events), "Containers" (containers + init containers, extracted to `pod-containers-panel.tsx`), and "Logs" (selectors + viewer, extracted to `pod-logs-panel.tsx`). Tab state is local React state.

### 5. Auto-load logs (`feature/pod-auto-load-logs`)
Removed the manual "Show logs" gate so the log viewer renders and the logs query runs on mount, defaulting to the first container. Snapshot behavior and the `KARSE_FAKE_LOGS` path unchanged.

### 6. Filter pods by phase (`feature/pod-phase-filter`)
A `PhaseFilter` MUI button opens a Menu of phase checkboxes (Running/Pending/Succeeded/Failed/Unknown), defaulting to all selected. Client-side filtering over the fetched pod list; composes with the existing name search. Registered `faFilter`.

### 7. Breadcrumbs (`feature/breadcrumbs`)
A `breadcrumbs.tsx` component derives a trail from the current route (MUI `Breadcrumbs` + Router `Link`s), mounted in `app-layout.tsx` above the outlet. Detail pages link back to their list (e.g. `Pods > <namespace> > <name>`, `Nodes > <name>`).

### 8. Shareable URL state (`feature/shareable-url-state`)
Page and resource were already in the route path; added selected context and namespace as `?context=` / `?namespace=` query params backed by the existing providers (via `useSearchParams`), so selection survives reload and link-sharing. Added `lib/nav-state.tsx` helpers (`useShareableNavigate`/`useShareableTo`) to preserve params across navigation; `BrowserRouter` moved above the providers in `main.tsx`. Backward compatible (absent params fall back to defaults).

### 9. Nav-bar dropdown pickers (`feature/navbar-dropdown-pickers`)
Converted the context and namespace quick pickers from MUI `Dialog` modals to MUI `Popover` dropdowns anchored to their header trigger buttons. Picker open-state, refs, and the keyboard shortcuts moved from `AppLayout` into `Header`. All selection/filter functionality preserved.

### 10. Stern-style multi-pod live logs (`feature/stern-live-logs`)
A new `/logs` page that aggregates `kubectl logs -f` (read-only follow) from every matching pod over Server-Sent Events, each line prefixed with `namespace/pod` and color-coded. Namespace dropdown, pod dropdown, and a wildcard/substring pod filter; stream/stop controls, auto-scroll, capped buffer. New `command-runner` async `stream()` helper, `streamPodLogs` adapter function (audited, read-only), and `routes/logs-stream-route.ts`. Honors `KARSE_FAKE_LOGS`. Client disconnect kills spawned processes.
- Deployment-scoped streaming (listed as optional) was not implemented; namespace + pod scoping plus wildcard filter (the stated minimum) are done.

### 11. Table hover consistency (`fix/table-hover-consistency`)
Found inconsistent/duplicated hover styling across tables and static tables with no hover. Factored a single `lib/table-row-style.ts` `tableRowSx(clickable)` helper applied to every table: all rows get the same `action.hover` highlight; clickable rows additionally show a pointer cursor.

### 12. Live single-pod logs (`feature/live-pod-logs`)
A "Live" toggle on the pod detail log viewer streams new lines in real time via `kubectl logs -f` over SSE (new `runStream` in `command-runner`, `streamPodLogs` adapter, SSE endpoint on the pod-detail route). Snapshot behavior retained when Live is off. Honors `KARSE_FAKE_LOGS`.
- Overlaps conceptually with items 5 and 10 but is the single-pod follow feature on the detail page; built independently off `main`.

### 13. Event log (`feature/event-log`)
A cluster/namespace-wide Events view: read-only `listEvents` adapter (`get events -A` or `-n <ns>` via the audit helper), `routes/events-route.ts`, and an `/events` page with a sortable react-table (last seen, type chip, reason, object, message, count, namespace), wired into the sidebar. Respects the selected namespace.

### 14. Random test ports (`fix/test-random-ports`)
New `backend/src/listen-server.ts` (`resolveRequestedPort`/`listen`/`getBoundPort`/`reportPort`) lets the backend honor `KARSE_PORT` (0 = OS-assigned free port) and report the bound port to stdout / a `KARSE_PORT_FILE`. `smoke-tests.sh` and `e2e-tests.sh` now start the stack on free ports, discover them, and run against them; Vite proxy follows the dynamic backend port. Normal `bun start`/`bun run dev` keep the 5172/5173 defaults. All async (no `*Sync`).

### 15. Remove setGlobalMutation kludge (`refactor/remove-setglobalmutation-kludge`)
The misnamed kubeconfig-write mutations on the namespaces and contexts pages were moved onto `KubeContextProvider` and exposed via `useKubeContext()` as `setTerminalDefaultContext` and `setDefaultNamespace`, removing the duplicated, misnamed loose mutations. No behavior change; still only the allowed kubeconfig mutations.

### 16. Node pods list (`feature/node-pods-list`)
The "pods on this node" feature already existed end to end (`getNodeDetail` runs `get pods -A --field-selector=spec.nodeName=<name>` and the node detail page renders the table with links). The gap was test coverage: added adapter Jest tests asserting the exact field-selector argv and node-scoped mapping, plus smoke assertions and an expanded manual-testing note.

### 17. Fuzzy search (`feature/fuzzy-search`)
Replaced the plain substring global filter on all seven searchable tables with a shared in-repo fuzzy filter (`lib/fuzzy-filter.ts`, case-insensitive subsequence match), so `ngnx`/`ng-x` match `nginx-deployment`. No new dependency (preferred the lightweight option).

### 18. Fix mixed node status test (`fix/mixed-node-status-test`)
Root cause: kwokctl starts the controller with `--manage-all-nodes=true`, so kwok drives heartbeats and keeps every node Ready, overwriting any patched `Ready=False`. Fix: start the controller with `--manage-all-nodes=false` and `--manage-nodes-with-annotation-selector=kwok.x-k8s.io/node=fake`, so a node created WITHOUT the annotation is left alone and its patched NotReady condition persists (verified live). Updated `04-mixed-node-statuses/` setup + README, `e2e-tests.sh`, removed the e2e API-interception workaround, added smoke assertions, and a backend unit test with a realistic mixed-conditions fixture (Ready / NotReady / cordoned / Unknown). The adapter's status derivation and chip rendering were already correct, so no adapter change was needed (read-only preserved). `Unknown` (lost-heartbeat) is awkward to hold steady in kwok, so it is covered by the unit fixture rather than the kwok scenario.

## Cross-cutting notes for inspection

- **Heavy e2e not executed.** Each branch ran compile + Jest + smoke green; the full kwok `bun run e2e` was not run per the run instruction. Run `bun run e2e` (or `bun run tests:all`) on each branch before merging if you want the full gate.
- **Manual-testing scenario numbering collides.** Several branches independently added a `docs/manual-testing/kwok/17-*` (and `18-*`) scenario directory, each branched off `main`. These will conflict on merge and should be renumbered as you integrate.
- **Overlapping items.** Items 4, 5, 10, and 12 all touch pod logs / the pod detail page and were built independently off `main`; expect merge overlap in `pod-detail-page.tsx`, `command-runner.ts`, `kubectl-adapter.ts`, and `api-client.ts`. Items 8 and 9 both restructure header/layout state. Item 16 was already implemented (only tests were added).
- **Stray permission commits (NOT feature work).** Two commits touching only `.claude/permissions.yaml` were created by the harness permission system during the run and were left in place (history was not rewritten):
  - `main` is 1 commit ahead of `origin/main` with `54b13e8 "Permissions."` (only `.claude/permissions.yaml`).
  - `feature/raw-yaml-view` has a trailing `9366bec "Permissions"` on top of the real feature commit `66635d7` (only `.claude/permissions.yaml`).
  Both can be dropped with a `git reset` if unwanted; they contain no feature code. The working tree on `main` is otherwise clean.
