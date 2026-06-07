# cross-cutting manual tests

App-wide manual tests with no single dedicated spec feature. Each scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Run the matching `teardown.sh` when done.

Start the app first: run `bun run dev` from the repo root and open the frontend at `http://127.0.0.1:5173`. Then run the scenario's `setup.sh`, test, and run its `teardown.sh` when done.

## Long resource names

A node, namespace, and pod each with names near the Kubernetes length limits. Verifies the UI handles long strings without breaking layout (truncation, overflow, wrapping).

**Fixture:** [_fixtures-kwok/11-long-resource-names](../_fixtures-kwok/11-long-resource-names/)

```sh
./docs/testing-manual/_fixtures-kwok/11-long-resource-names/setup.sh
```

### What to check
- **Nodes table**: the long node name renders without overflowing its cell or the table boundary.
- **Namespace picker**: the long namespace name renders without breaking the picker layout.
- **Pods page**: the long pod name renders cleanly in the pods table.
- Resize the browser window to a narrow viewport and confirm no layout breaks occur.

## Breadcrumb navigation

A node and a pod. Exercises the breadcrumb trail in the top navbar and confirms breadcrumb links navigate back to list pages. The first crumb (the main page) is shown in large, title-sized text; the remaining sub-page crumbs use the regular breadcrumb size.

**Fixture:** [_fixtures-kwok/22-breadcrumbs](../_fixtures-kwok/22-breadcrumbs/)

```sh
./docs/testing-manual/_fixtures-kwok/22-breadcrumbs/setup.sh
```

### List pages
- Navigate to `/pods`. Confirm the breadcrumb trail appears in the top navbar showing a single, title-sized crumb "Pods".
- Navigate to `/nodes`, `/deployments`, `/statefulsets`, `/daemonsets`, `/namespaces`, `/contexts`, and `/cluster`. Confirm each shows a single crumb matching the page (Nodes, Deployments, StatefulSets, DaemonSets, Namespaces, Contexts, Cluster).

### Pod detail page
- Navigate to `/pods` and click the `web` row. Confirm the breadcrumb trail shows "Pods > default > web > Detail / Status", with "Pods" in large title-sized text.
- Switch to the Containers and Logs tabs. Confirm the last crumb updates to "Containers" then "Logs", matching the selected sub tab.
- Confirm "Pods" and the pod name ("web") are clickable links, while the namespace ("default") and the current sub-tab crumbs are not links.
- Click the "Pods" breadcrumb. Confirm the browser navigates back to `/pods` and the trail collapses to a single "Pods" crumb.

### Node detail page
- Navigate to `/nodes` and click the `fake-node-1` row. Confirm the breadcrumb trail shows "Nodes > fake-node-1".
- Click the "Nodes" breadcrumb. Confirm the browser navigates back to `/nodes` and the trail collapses to a single "Nodes" crumb.

## Shareable URL state

Every meaningful piece of UI state lives in the URL so a link can be copied and reopened to reproduce the exact same view:
- **Page** is the path (`/cluster`, `/nodes`, `/pods`, `/deployments`, `/namespaces`, `/contexts`, ...).
- **Resource** is in the path on detail pages (`/nodes/<name>`, `/pods/<namespace>/<name>`).
- **Context** is the `?context=<name>` query param.
- **Namespace** is the `?namespace=<name>` query param (absent means "all namespaces").

Because all four are in the URL, the address bar is always a shareable link.

Two KWOK clusters run simultaneously so context switching is observable. Cluster 1 (`kwok-karse-test-1`) has 2 nodes and pods `web-pod` (namespace `team-a`) and `cache-pod` (namespace `team-b`). Cluster 2 (`kwok-karse-test-2`) has 1 node (`fake-node-a`), so the data visibly differs after a switch.

**Fixture:** [_fixtures-kwok/23-shareable-url-state](../_fixtures-kwok/23-shareable-url-state/)

```sh
./docs/testing-manual/_fixtures-kwok/23-shareable-url-state/setup.sh
```

### How to test any shareable link
1. Navigate to the exact view you want to share: pick the context, pick the namespace, go to the page, and (for detail views) click into the specific node or pod.
2. Get the **full** URL. Either copy it from the address bar, or click the **Share** button (the share icon in the navbar, to the left of Refresh): it copies the current page URL to the clipboard and briefly shows a check mark to confirm.
3. Open a fresh browser tab (or a private/incognito window so nothing is cached) and paste the URL.
4. Confirm the new tab opens on the identical view: same page, same context (same cluster data), same namespace selection, and the same resource if it was a detail page.

The URL should already contain everything: the page and resource in the path, and `?context=`/`?namespace=` in the query string. Nothing about the view should depend on hidden in-memory state.

### Worked examples

#### Share a node detail view
1. Go to **Nodes** (cluster 1). Click the `fake-node-1` row.
2. The address bar reads `/nodes/fake-node-1` (cluster 1 is the terminal default, so no `?context=` is needed yet).
3. Switch context to cluster 2 with the header dropdown, then back to cluster 1: now the URL carries `?context=kwok-karse-test-1` explicitly. This is the form you would send someone who defaults to a different cluster.
4. Copy `/nodes/fake-node-1?context=kwok-karse-test-1` into a fresh tab. It opens directly on that node's detail page, reading cluster 1, every time.

#### Share a pod detail view (page + resource + namespace + context)
1. Go to **Pods** (cluster 1). Open the namespace picker (Ctrl+Shift+K) and select `team-a`. The URL gains `?namespace=team-a` and the list narrows to `web-pod`.
2. Click the `web-pod` row. The URL becomes `/pods/team-a/web-pod?namespace=team-a` (add `&context=kwok-karse-test-1` if you switched clusters). The namespace and pod identity are both in the link.
3. Copy that URL into a fresh tab: it opens straight onto the `web-pod` detail page with `team-a` selected. Repeat with `cache-pod` in `team-b` to confirm a different resource shares correctly.

#### Share a filtered list view
1. Go to **Pods**, select namespace `team-b`. URL: `/pods?namespace=team-b`, list shows only `cache-pod`.
2. Copy and open in a fresh tab: the pods list opens already scoped to `team-b`.

#### Share a view of a specific cluster
1. On any page, switch context to cluster 2. URL gains `?context=kwok-karse-test-2`; the node count drops to cluster 2's single `fake-node-a`.
2. Copy e.g. `/nodes?context=kwok-karse-test-2` into a fresh tab: it opens reading cluster 2 without touching your terminal's current context.

### What to check
- **Share button copies the current URL**: on any view, click the Share button in the navbar. It copies the current page URL to the clipboard and shows a check mark briefly. Paste into a fresh tab to confirm it reopens the same view. This works on list pages and on node/pod detail pages, and includes the `?context=`/`?namespace=` params.
- **Every page is shareable**: visit `/cluster`, `/nodes`, `/pods`, `/deployments`, `/statefulsets`, `/daemonsets`, `/namespaces`, `/contexts`. In each case the path identifies the page, and a copied URL reopens that page.
- **Every detail page is shareable**: node detail (`/nodes/fake-node-1`) and pod detail (`/pods/team-a/web-pod`) reopen on the exact resource.
- **Context goes into the URL**: switching context (header dropdown or Ctrl+K) sets `?context=...`; the data updates to that cluster.
- **Namespace goes into the URL**: selecting a namespace (Ctrl+Shift+K) sets `?namespace=...`; choosing "All namespaces" removes it.
- **Reload preserves state**: with params in the address bar, F5 keeps the same context, namespace, page, and resource (no reset to the terminal default).
- **Params survive navigation**: with a context/namespace selected, click around the sidebar and into/out of detail pages. The query params stay attached the whole time.
- **Backward compatible default**: open `/cluster` with no query params. The app falls back to the terminal's current context (cluster 1) and "all namespaces".
