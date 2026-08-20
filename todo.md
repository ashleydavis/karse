# Todo

- Looking at the Autoscalers table (and probably the other tables), the Labels column has only around 3 labels per row, but it goes of the screen and there's no way we can see the final labels. Can we get a horiz scrollbar on the table so we can see the end of these?
- It doesn't make sense having to context pickers. I like the one that's the name of the context with the dropdown showing other context. Can you fold the features of the other context picker into that one and remove the second one.
- I'd like the namespace picker to be more like the first context picker. It should show the name of the namespace and clicking it should invoke the dropdown. The existing dropdown is good, just replace with icon/button that triggers it with the name of namespace.
- Counts of resources should be links to the list that produced them, with the matching filter applied. Dan asked for Health Signals OOMKills → pods filtered to OOMKilled; do the same for the other still-plain counts (Pending pods, Node count, Node pressure, the over/healthy/under node-utilisation strip, and the Total/Healthy/Error chips on list pages). Leave non-count numbers alone (server version, CPU/memory %, CPU throttling N/A, table cell metrics like restarts/min/max).
- The column widths in the filters drop down don't handle long text in each name. The name will overlap the checkbox/text in the next columns. You need to enable some kind of clipping so this can't happen. You should probably make the drop a bit wider and the columns a bit wider as well. You should also truncate long names, adding "..." to the end when they don't fit.
- Wide tables hide trailing columns and the horizontal scrollbar is below the fold.
  - Repro: Open `/pods`, `/errors`, `/events`, `/autoscalers`, `/all-resources`, or `/nodes` on a cluster whose Labels (or Message/Count) columns don't fit. At a ~1440px window the last columns are off-screen. Scroll the *page* to the bottom of the 100-row table to find the horizontal scrollbar. `TableContainer` already has `overflow-x: auto` (`frontend/src/pages/*/components/*-table.tsx`). Related to the Labels-column item above, but the real defect is scrollbar placement, not missing overflow.
  - Why: Users never see Count, Namespace, Labels, or CPU/Memory. A scrollbar that only appears after scrolling past 100 rows might as well not exist.
  - Fix: Give the table body a viewport-bounded max-height so `TableContainer` scrolls vertically *and* horizontally inside the window (sticky header + scrollbar always visible). Don't raise `ROW_RENDER_LIMIT` as the fix.

- Namespace detail is blank while it loads.
  - Repro: Open `/namespaces/<any>` (or click a Namespace cell). For ~1–3s the main pane is empty: breadcrumbs update, no spinner. `frontend/src/pages/namespace-detail/index.tsx` does `if (isLoading || !data) return null`.
  - Why: Every other detail page uses `LoadingIndicator`. A blank page reads as a crash.
  - Fix: Return `<LoadingIndicator />` like `pod-detail` / `node-detail`.

- Clicking a resource row often opens the nested Namespace/Object instead of the row.
  - Repro: On `/pods`, click the first row's Namespace cell (blue link) — you land on `/namespaces/...`, not the pod. On `/events`, click the Object cell — you land on that resource (often generic detail), not `/events/:uid`. Clicking the Name cell *does* open the row, but Name is not styled as a link (`CopyNameCell` is plain text).
  - Why: `ResourceRef` correctly `stopPropagation`s. Name looks inert; Namespace/Object look like the thing to click. The clickable-row affordance is the wrong colour.
  - Fix: Make the Name column a `ResourceRef` (or equivalent link) to the row's own detail page, same visual as Namespace. Keep nested links stopping propagation. Don't remove row-click.

- Error detail Details grid overlaps.
  - Repro: Open `/errors`, click a row whose Object is a long `Kind/name` (e.g. a HorizontalPodAutoscaler). On `/errors/:index` the Details card (`minmax(220px, 1fr)` in `frontend/src/pages/error-detail/index.tsx`) stacks Object, Reason, Namespace, and Count on top of each other. Same overflow family as the filter-dropdown item above.
  - Why: `ResourceRef` is name + copy + menu, wider than 220px, and the grid doesn't clip.
  - Fix: Allow grid items to shrink (`minWidth: 0`), nowrap+ellipsis the value, keep copy/menu from overflowing. Widen the minmax if needed.

- Error detail URLs are list indexes and the breadcrumb always says "Error".
  - Repro: Click the first Errors row → `/errors/0`. Refresh after the list reorders, or open two errors in two tabs. Breadcrumb is `Errors > Error` (`frontend/src/components/breadcrumbs.tsx`). Navigation is `navigate(\`/errors/${unfiltered.indexOf(error)}\`)` in `errors-table.tsx`. `ClusterError` has no uid.
  - Why: Index 0 is a different error after refetch. Several tabs all titled "Error". Event detail already uses `/events/:uid`.
  - Fix: Identify a row by a stable key (source + namespace + objectKind + objectName + reason + firstSeen), put it in the path or query, look it up after refetch, keep the existing not-found panel. Breadcrumb leaf = reason.

- Long lists look complete at 100 rows; All resources looks like a pods-only page.
  - Repro: `/all-resources` on a cluster with many pods. First screen is 100 Pods (`ROW_RENDER_LIMIT` in `data-table-row.tsx`; rows are aggregated pods-first in `frontend/src/lib/all-resources.ts`). Other kinds need Kind filter or many "Show more" clicks at the table bottom. Same on `/events` and `/errors` when those lists are long. The "N of M" count (errors/events) does not say only 100 are rendered.
  - Why: Users conclude All resources doesn't list Deployments/HPAs. Search/filter still run over every row, but that is invisible.
  - Fix: Keep the render cap. Put "Showing 100 of N — Show more" in the toolbar (not only a row at the bottom). On All resources, consider default-sorting Kind so kinds mix, or a Kind summary. Don't dump every row into the DOM.

- Nodes/Pods CPU and Memory paint as em-dashes, then fill in (or stay empty if you don't wait).
  - Repro: Open `/nodes` or `/pods` on a cluster with Metrics API (or `KARSE_FAKE_METRICS=1` + the resource-utilization fixture). The table appears immediately with Utilization/CPU/Memory as `—`. Cluster Overview already shows CPU/memory for the same snapshot (`["cluster-performance", context]`). The list query (`fetchNodes`/`fetchPods`) is what gates `LoadingIndicator`; performance is a second unawaited query in `nodes-table.tsx` / `pods-table.tsx`.
  - Why: The page looks finished and "metrics are broken".
  - Fix: Don't treat the table as fully loaded until the performance query settles (or show a loading/skeleton state on those columns only). If metrics are truly unavailable, keep the em-dash and the existing Metrics-API notice.

- List-page Total / Healthy / Error chips don't add up.
  - Repro: Open `/daemonsets` (or Deployments/StatefulSets/Pods) where some rows are partially ready. Header: Total T, Healthy H, Error 0 with H + 0 ≠ T. Filter Health has only Healthy and Error (`HEALTH_FILTER_OPTIONS` in `resource-stats.ts`). Partially-ready daemonsets are `"Other"` (`daemonSetHealth`).
  - Why: The header looks like a counting bug. Other is documented as intentional but the UI hides it.
  - Fix: Add an Other chip (and Health filter option) so Total = Healthy + Error + Other. Clicking a chip should apply that Health filter (see the count-links item above).

- Pods can read all-Healthy while Cluster Errors is non-zero.
  - Repro: Cluster Overview Errors tile > 0, then `/pods`. Header can still be Healthy: N / Error: 0. `podHealth` is phase-only (Running/Succeeded = Healthy) in `resource-stats.ts`. Errors also flag Running pods with problem container reasons (`podProblem` / OOMKilled, CrashLoopBackOff, … in the kubectl adapter).
  - Why: Two pages disagree about whether anything is wrong. A CrashLoop pod looks fine on Pods.
  - Fix: Reuse the same problem-pod rules as the Errors feed when classifying `podHealth` (Running + bad container reason → Error). Keep Pending as Other.

- Logs Stream is enabled with nothing selected.
  - Repro: Open `/logs`. Leave Namespace and pod search empty. Stream is enabled (`disabled={current === null}` in `log-viewer.tsx`). Click it: no stream, "Streaming every pod at once is not supported" / empty viewer.
  - Why: A primary button that fails on click.
  - Fix: Disable Stream until a namespace is chosen and at least one pod is checked or the pod search is non-empty. Tooltip on the disabled button explaining why.

- All clusters headlines totals from the clusters that loaded, even when most failed.
  - Repro: Open `/clusters` with several kubeconfig contexts, some Unauthorized/unreachable. Cards show node/CPU/memory totals for the reachable subset. Caption: "Totals cover X of Y clusters (Z could not be read…)". Failed rows are dashes + a Status error.
  - Why: The section is titled "Across all clusters". Headline CPU % looks like the whole estate.
  - Fix: When `failedCount > 0`, make the coverage warning prominent (Alert, not a caption) and qualify the card labels ("Nodes (N of M clusters)"). Status remains the per-row explanation. A retry on a failed row would help; don't invent a login flow.

- Cluster Resource-utilization treemap labels are unreadable (legend missing). Cells already navigate.
  - Repro: Cluster → Resource utilization. Node names are middle-truncated to ~14 chars (`NODE_LABEL_MAX` in `usage-treemap.tsx`); tall cells rotate text. Green/amber/red has no legend. Leaf click already goes to node/pod Performance (`onClick` in the same file).
  - Why: You can't tell which node is which, or what the colours mean.
  - Fix: Prefer a shorter label (last hostname label) plus tooltip (already has usage). Stop rotating type, or only rotate when the box is taller than it is wide *and* the unrotated label doesn't fit. Add a compact utilisation legend next to the CPU/MEMORY toggle.

- Generic detail opened from Events loses sidebar highlight and truncates the crumb; annotation JSON is clipped.
  - Repro: `/events`, click an Object that isn't Pod/Node/Deployment/… (a kind that uses generic detail). You get `/resources/...` with `from=/events`. Sidebar highlights nothing (`fromAllResources` only treats `from=all-resources` in `sidebar.tsx`). Breadcrumb middle-truncates at 24 chars (`MAX_NAME_LENGTH`) despite empty header space. Annotations `last-applied-configuration` is a one-line truncated JSON cell (`resource-detail/index.tsx`).
  - Why: You don't know which nav section you're in. The crumb hides the name you need. The annotation looks broken.
  - Fix: Highlight Events when `from` is the events list (same pattern as All resources). Don't truncate the leaf crumb when the header has room (truncate only when it would wrap). For huge annotation values, wrap/expand or send the user to the YAML tab.

- Contexts table repeats the same long cluster identity in CLUSTER and USER; Production chips look like errors.
  - Repro: `/contexts` against a kubeconfig whose cluster and user names are the same long string. Production chip uses MUI `color: "error"` (`DEFAULT_ENVIRONMENTS` in `cluster-environments.ts`).
  - Why: The useful columns (name, environment, actions) are squeezed. Red = danger, not "this is prod".
  - Fix: Hide USER by default (column config already exists) or show a shortened form with the copy menu. Change the shipped Production colour to a non-alert palette (keep it configurable).

- Header right side is an unlabeled icon row (partly the two-picker item above).
  - Repro: Any page. Right of the named context dropdown: link icon (context quick-pick), layers (namespace), help, timestamps, theme, share, refresh. Tooltips exist on some; the row still reads as icon soup. Do the context/namespace picker consolidation above first.
  - Why: The named context dropdown already switches context. The extra link icon looks duplicate. Namespace has no visible current value (that's the namespace-picker item above).
  - Fix: After folding the context quick-pick into the named dropdown and replacing the namespace icon with the current namespace name, leave help/timestamps/theme/share/refresh. Keep a tooltip on each remaining icon.

- Errors and Events disagree on the timestamp column name; Events `0m` looks empty.
  - Repro: `/errors` column "Age" vs `/events` column "Last seen", both a relative age (`Timestamp`). An event that just fired shows `0m`.
  - Why: Same field, two names. `0m` reads as missing, not "just now".
  - Fix: Use one header on both tables (prefer "Last seen" since that's the sort key). Render ages under one minute as "just now" (or `Ns`) so `0m` never appears.

- Cluster Overview Pods tile counts Succeeded Job pods as pods, next to a green Succeeded status.
  - Repro: Cluster Overview. Pods tile = all phases; sublabel is running count. Pod status row includes Succeeded (remainder: total − running − pending − failed). Completed Jobs inflate the tile vs "running".
  - Why: Succeeded looks healthy; the headline pod count looks like live workload size.
  - Fix: Keep Succeeded as a filter link (already). Make the Pods tile primary number the running count (or show "N running / M total"). Don't drop Succeeded from the status row.

## Me

- Check the performance metrics and make sure they are good.

## Later

