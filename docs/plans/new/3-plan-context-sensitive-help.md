# Context-sensitive help drawer

**Sequence:** 3 of 3 — [Resource utilization](README.md#resource-utilization-prototype--karse). UI wiring after **1**; can overlap with **2**.

## Overview

Karse needs the explanatory content from the prototype's hover tooltips (`/home/ash/Downloads/k8s-dashboard`, `[data-tooltip]` blocks) as first-class, maintainable documentation. Each article that explains a metric or health signal must also tell the user **how to look up the same figure themselves with kubectl**, using the commands documented in the prototype's `kubectl-reference.md`. Implement a **context-sensitive help system**: help articles live in `docs/help/` (one file per topic, stable string id), UI elements declare their help id, hovering an element opens a **right-hand MUI Drawer** showing that article, and the drawer can be **pinned** open so it stays visible while moving the pointer. This plan is independent of the utilization dashboard and colours plans but should reuse their `data-help-id` hook points when those land.

## Issues

<!-- populated later by plan:check -->

## Steps

### Spec and help content layout

1. Create `docs/spec/context-help/index.md` and `detail.md` describing: file layout under `docs/help/`, id conventions, hover vs pinned behaviour, backend read API, accessibility fallbacks (keyboard focus opens help for focused element), and the **article structure convention** (below).

   **Article structure convention** — every help file uses this layout:
   1. **What it is** — plain-language definition (from prototype tooltip copy).
   2. **How to interpret it** — thresholds, green/amber/red meaning where relevant.
   3. **Look it up with kubectl** — one or more fenced `bash` code blocks with the exact read-only commands a user can run locally to reproduce the figure Karse shows. Prefix with one sentence: confirm context with `kubectl config current-context`. Note when Metrics Server is required (`kubectl top`). Use `<node-name>`, `<pod-name>`, `<namespace>` placeholders; never inject live cluster values into help files.
   4. **Tips** (optional) — one-line caveats (point-in-time snapshot, read-only, etc.).

   Metric/health articles **must** include section 3. Pure UI chrome articles (e.g. colour guide entries, toggle explanations) omit kubectl commands unless a command clarifies the concept (Usage vs Requests may cite `kubectl describe node … Allocated resources` vs `kubectl top`).

2. Create directory `docs/help/` with an `index.md` listing all help ids (maintained manually or generated in a later pass).

3. Copy the prototype command reference into the repo as the authoring source: create `docs/help/kubectl-reference.md` (adapted from `/home/ash/Downloads/k8s-dashboard/kubectl-reference.md` — same commands, Karse-neutral wording, no prototype-specific paths). This file is **not** served as a hover target; it is the canonical command list authors pull from when writing per-topic help. Register its id in `docs/help/index.md` under a "Reference" section so it can be opened deliberately later if needed.

4. Seed help files by porting prototype tooltip copy (HTML → Markdown, no scripts) **and** the matching kubectl commands from `docs/help/kubectl-reference.md` into each file's **Look it up with kubectl** section. Minimum set for utilization v1 (ids are kebab-case filenames without extension):

   | Help id | kubectl commands to include (from reference) |
   |---------|-----------------------------------------------|
   | `view-mode-usage-requests.md` | `kubectl top nodes` (usage) vs `kubectl describe nodes \| grep -A 5 "Allocated resources"` (requests); brief note on the difference |
   | `view-format-percent-absolute.md` | no commands (UI-only); optional one-liner that `%` comes from dividing usage/requests by capacity |
   | `cluster-cpu-usage.md` | `kubectl top nodes`; `kubectl top pods --all-namespaces --sort-by=cpu` |
   | `cluster-cpu-requests.md` | `kubectl describe nodes \| grep -A 5 "Allocated resources"` (cpu row) |
   | `cluster-memory-usage.md` | `kubectl top nodes`; `kubectl top pods --all-namespaces --sort-by=memory` |
   | `cluster-memory-requests.md` | `kubectl describe nodes \| grep -A 5 "Allocated resources"` (memory row) |
   | `health-pending-pods.md` | `kubectl get pods --all-namespaces --field-selector=status.phase=Pending`; `kubectl describe pod <pod-name> -n <namespace>` |
   | `health-oomkills.md` | `kubectl get pods --all-namespaces \| grep -v Running \| grep -v Completed`; `kubectl describe pod …` (Last State / OOMKilled); `kubectl get pods --all-namespaces --sort-by='.status.containerStatuses[0].restartCount'` |
   | `health-cpu-throttling.md` | state kubectl cannot expose throttling; proxy: `kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.spec.containers[*].resources}'`; mention `container_cpu_cfs_throttled_periods_total` needs Prometheus |
   | `health-node-count.md` | `kubectl get nodes`; `kubectl get nodes --no-headers \| wc -l` |
   | `health-node-pressure.md` | `kubectl describe nodes \| grep -A 5 "Conditions:"`; custom-columns Memory/Disk/PID pressure one-liner |
   | `nodes-summary-over.md` / `-healthy.md` / `-under.md` | `kubectl describe node <node-name> \| grep -A 3 "Allocated resources"` (CPU requests % per node); explain thresholds in prose |
   | `table-column-cpu.md` | scope-dependent commands block: cluster → `kubectl top nodes` / sorted pods; node → `kubectl top node <node-name>`; pod → `kubectl top pod <pod-name> -n <namespace>` |
   | `table-column-memory.md` | same pattern as CPU with memory sort / top pod |
   | `node-condition-ready.md` | `kubectl describe node <node-name>` (Conditions section) |
   | `node-condition-memory-pressure.md` | pressure custom-columns or `kubectl describe node <node-name>` |
   | `node-condition-disk-pressure.md` | same |
   | `node-condition-pid-pressure.md` | same |
   | `pod-status.md` | `kubectl get pod <pod-name> -n <namespace>`; `kubectl describe pod …` |
   | `pod-restarts.md` | `kubectl describe pod …` (Restart Count) |
   | `pod-last-exit-reason.md` | `kubectl describe pod …` (Last State / Terminated reason) |
   | `pod-cpu-requested.md`, `pod-cpu-limit.md`, `pod-cpu-usage.md`, `pod-memory-requested.md`, `pod-memory-limit.md`, `pod-memory-usage.md` | `kubectl describe pod …` (Limits/Requests); `kubectl top pod …` for usage rows |
   | `node-cpu-usage.md`, `node-memory-usage.md` | `kubectl top node <node-name>`; `kubectl describe node … Allocated resources` for requests |
   | `color-guide-green.md` etc. | no kubectl section |

   Each file starts with YAML frontmatter:
   ```yaml
   ---
   id: cluster-cpu-usage
   title: CPU usage
   ---
   ```
   Body is Markdown (paragraphs, bold emphasis, bullet thresholds, fenced `bash` blocks). No React/HTML.

   **Example excerpt** for `cluster-cpu-usage.md` (body only; show `Look it up with kubectl` heading, a line telling the user to run `kubectl config current-context`, then fenced blocks for `kubectl top nodes` and `kubectl top pods --all-namespaces --sort-by=cpu`, plus a Metrics Server unavailable note).

### Backend: help file reader

5. Create `backend/src/help/help-reader.ts`:
   - Export `listHelpIds(): Promise<string[]>` — reads `docs/help/*.md` filenames (excluding `index.md`).
   - Export `getHelpArticle(id: string): Promise<{ id: string; title: string; bodyMarkdown: string }>` — reads `docs/help/<id>.md`, parses frontmatter (use a tiny frontmatter parser or `gray-matter` if already a dependency; otherwise split on `---` manually).
   - Resolve help directory: `path.join(process.cwd(), "..", "docs", "help")` when cwd is `backend/` (same pattern as audit logs / `KARSE_LOGS_DIR`).
   - Reject ids outside `[a-z0-9-]+` and block path traversal (`..`, slashes).
   - `listHelpIds` includes all `*.md` except `index.md` (including `kubectl-reference` for optional full reference fetch).

6. Create `backend/src/routes/help-route.ts`:
   - `GET /api/help` → `{ ids: string[] }`.
   - `GET /api/help/:id` → `{ id, title, bodyMarkdown }` or 404.
   - Register in `backend/src/app.ts` (or routes bootstrap).

7. Add unit tests `backend/src/tests/help/help-reader.test.ts`:
   - Loads a fixture file from a temp directory (include a **Look it up with kubectl** section with a fenced `bash` block in the fixture).
   - Rejects invalid ids.
   - Parses frontmatter title; body retains command blocks verbatim.

8. Add route test `backend/src/tests/routes/help-route.test.ts` for 200/404; assert `GET /api/help/cluster-cpu-usage` body includes `kubectl top nodes`.

9. Update `docs/api.md` with help endpoints.

### Frontend: help state and API

10. Create `frontend/src/lib/help-api.ts`:
   - `fetchHelpIds()`, `fetchHelpArticle(id: string)` via axios `/api/help`.

11. Create `frontend/src/lib/help-context.tsx`:
    - State: `{ open: boolean; pinned: boolean; activeId: string | null; article: HelpArticle | null; loading: boolean }`.
    - Actions: `showHelp(id)` (fetch article, set open true), `hideHelp()` (if !pinned), `pin()`, `unpin()`, `close()` (force close, clear pin).
    - Persist `pinned` in `localStorage` key `karse-help-pinned` (boolean only; not the active article).
    - Debounce hover: `scheduleShow(id, delayMs=300)`, `cancelShow()` to avoid flicker when crossing elements.

12. Create `frontend/src/components/help/help-drawer.tsx`:
    - MUI `Drawer` `anchor="right"`, width ~360–420px (wide enough for command lines without excessive wrap), `data-test-id="help-drawer"`.
    - Header: article `title`, Pin/Unpin icon button (`data-test-id="help-pin"`), Close button.
    - Body: render `bodyMarkdown` with `react-markdown` (add dependency if absent) plus `remark-gfm` only if needed; **must** render fenced code blocks (`language-bash`) as MUI `Paper`/`Box` with monospace font, horizontal scroll, and `data-test-id="help-kubectl-command"` on each `<pre>` (or one per block). Optional: copy-to-clipboard icon on code blocks (nice-to-have, not required for v1).
    - When `loading`, show `LoadingIndicator`; on error, short message.
    - Pinned drawer stays open when pointer leaves help targets; unpinned closes on `mouseleave` from drawer content area only if focus not inside.

13. Create `frontend/src/components/help/help-target.tsx`:
    - Props: `{ helpId: string; children: React.ReactNode; component?: ElementType }`.
    - Wraps children; sets `data-help-id={helpId}`.
    - `onMouseEnter` → `scheduleShow(helpId)`; `onMouseLeave` → `cancelShow()` + `hideHelp()` if !pinned.
    - `onFocus` → `showHelp(helpId)` for keyboard accessibility.

14. Create `frontend/src/components/help/help-provider.tsx`:
    - Combines `HelpContext.Provider`, mounts `HelpDrawer` once at app shell level.

15. In `frontend/src/components/app-layout.tsx`, wrap layout with `HelpProvider` (inside theme/query providers, sibling to main content).

### Wire help ids to UI

16. Add `HelpTarget` wrappers to utilization components (after dashboard plan):
    - `view-toggles.tsx` — both toggle groups.
    - `metric-card.tsx` — prop `helpId` per card (maps to cluster/node/pod metric ids above).
    - `health-signal-card.tsx` — prop `helpId` per tile.
    - `node-summary-strip.tsx` — each card.
    - Table column headers in cluster workloads, nodes, pods, node detail pods — pass column-specific ids (`table-column-cpu`, `table-column-memory`, or scoped variants).
    - Node detail condition chips/cards.
    - Pod detail Performance panel tiles — `pod-cpu-requested`, `pod-cpu-limit`, `pod-cpu-usage`, etc.

17. Add help targets to existing non-utilization surfaces incrementally (cluster stat tiles, Performance treemap section title) using ids from `docs/help/` as files are written.

18. Do **not** remove prototype-style inline tooltips if any were added; replace with HelpTarget only.

### Documentation

19. Update `docs/user-guide.md` — "Context help" section: hover to preview, pin to keep open, articles live in `docs/help/`, each metric article includes **Look it up with kubectl** commands the user can run locally.
20. Update `docs/development.md` — how to add a help article (create `docs/help/<id>.md` following the four-part structure, copy commands from `docs/help/kubectl-reference.md`, wrap UI with `HelpTarget`).
21. Create `docs/testing-manual/context-help/index.md` and `detail.md` (include step: hover cluster CPU card, confirm drawer shows `kubectl top nodes` in a code block).

### E2E and smoke

22. Extend `scripts/smoke-tests.sh`: `GET /api/help` returns ids array; `GET /api/help/cluster-cpu-usage` returns 200 with title and `bodyMarkdown` containing `Look it up with kubectl` and `kubectl top nodes`.
23. Add `e2e/src/e2e.test.ts` block `test.describe("context help")`:
    - Hover cluster CPU metric card (or element with `data-help-id="cluster-cpu-usage"`); drawer opens with title and **Look it up with kubectl** heading; assert `[data-test-id="help-kubectl-command"]` contains `kubectl top nodes`; screenshot light + dark.
    - Hover Usage/Requests toggle; drawer shows both `kubectl top` and `describe nodes` commands where applicable.
    - Click pin; move mouse away; drawer stays open; screenshot.
    - Unpin and close; drawer hidden.

## Unit Tests

- `getHelpArticle` parses frontmatter and body (`backend/src/tests/help/help-reader.test.ts`).
- `getHelpArticle` rejects invalid id (`backend/src/tests/help/help-reader.test.ts`).
- `GET /api/help/:id` 200 and 404 (`backend/src/tests/routes/help-route.test.ts`).

## Smoke Tests

- `GET /api/help` → 200, body has `ids` array including at least one seeded id.
- `GET /api/help/cluster-cpu-usage` → 200 with `title`, `bodyMarkdown` containing `Look it up with kubectl` and `kubectl top nodes`.

## Verify

- Run `bun run compile`.
- Run `bun run tests:all`.
- Hover cluster CPU card → drawer shows interpretation text **and** fenced kubectl commands (`kubectl config current-context`, `kubectl top nodes`) rendered monospace with horizontal scroll.
- Hover Usage/Requests toggle → drawer shows commands distinguishing usage vs requests.
- Pin drawer → navigate to another page → drawer remains (pinned state); article updates on new hover target.
- Invalid help id returns 404 from API; UI shows graceful error in drawer.

## Notes

- **Hover vs mobile**: v1 is hover + focus driven; touch devices can use long-press or a future explicit "?" affordance — document limitation in spec.
- **Markdown rendering**: keep subset safe (no raw HTML in help files); sanitize if using full markdown renderer; code blocks are display-only (Karse does not run kubectl on the user's behalf from the drawer).
- **kubectl-reference.md**: single maintained command cheat sheet; when Karse's data sources change, update reference first then sync per-topic help files.
- **Metrics Server**: any article citing `kubectl top` must state the Metrics API / Metrics Server requirement and the typical `Metrics API not available` error (from prototype reference).
- **Ordering**: can start content files in parallel with code; UI wiring depends on utilization components existing for bulk of ids.
- **Colours plan**: legend popup (left) is reference; help articles (right drawer) carry the long-form "how to interpret" text from prototype tooltips **plus** self-service kubectl commands — complementary, not duplicate UI.
- **Security**: help reader is read-only, allowlisted ids only, local-only app; no user-supplied paths; help content is static markdown only (no command execution from the UI).
