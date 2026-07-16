# Karse user guide

## What Karse is (and isn't)

Karse is a local-only dashboard for looking at your Kubernetes clusters through your existing `kubectl` setup. It gives you read-only visibility into your clusters for whichever kubeconfig context you have selected.

Karse **is**: a read-only viewer plus a convenient context and namespace switcher. Karse **is not**: a cluster management tool. It never creates, edits, or deletes anything in a cluster. The two things it writes to your local kubeconfig are the active context (`kubectl config use-context`) and the default namespace for a context (`kubectl config set-context --namespace`).

## Prerequisites

- `kubectl` on your `PATH`, configured against at least one cluster.
- `bun` (any installation method works; mise users can run `mise install`).
- At least one kubeconfig context. Karse shells out to `kubectl`, which reads your kubeconfig as normal; Karse does not set up clusters or credentials for you.

## Setup

If you use mise, install Bun first (optional):

```sh
mise install
```

Then install dependencies:

```sh
bun install
```

## Running

```sh
bun start
```

Open http://localhost:5173.

## Navigation

The left sidebar has collapsible navigation. Click the chevron at the bottom to collapse it to icons only; hover an icon to see a tooltip with the page name.

- **Contexts**: manage kubeconfig contexts.
- **Cluster**: overview tiles and cluster stats.
- **Nodes**: the node table for the active context.
- **Namespaces**: list and select namespaces.
- **Pods**: list pods for the active context and namespace.
- **Autoscalers**: the horizontal pod autoscalers (HPAs) for the active context and namespace, and how they are performing.

### Following a resource to its detail page

Every reference to a resource is a link to that resource's own detail page, so any resource is one click away wherever you see it mentioned:

- **Table rows**: click a row to open the resource it names.
- **Cells within a row**: a row's **Namespace**, **Node**, and **Object** cells link to that namespace, node, or referenced resource, rather than to the row's own target. Clicking one of those cells opens the resource it names; clicking anywhere else on the row opens the row's resource.
- **Detail-page fields**: a pod's **Namespace** and **Node**, a workload's **Namespace**, a container's **Pod**, and the object an error or event refers to are all links.
- A reference to something Karse has no detail page for (a ReplicaSet, a Service) is shown as plain text, not a broken link.

### The breadcrumb shows how you got there

The breadcrumb trail at the top of a detail page reflects the path you actually took, not a fixed trail. Open the `web` pod from a node's **Pods** tab and the trail reads `Nodes > node-worker > web`; open the same pod from its namespace and it reads `Namespaces > default > web`; open it from the **Pods** list and it reads `Pods > default > web > Status`.

Clicking the origin crumb returns you to the exact view you left, including the sub tab that was open. The **back** button on a pod's detail page goes to the same place, so it never disagrees with the breadcrumb.

While a page is fetching its data from the cluster, it shows a large, clearly visible loading spinner alone (no text) in place of the content. The spinner is replaced by the data once it loads, or by an error message if the request fails. This applies to every resource list page and detail page.

If the cluster does not respond within about 15 seconds (for example because your internet or VPN is down), the spinner stops and an error is shown instead of spinning forever. The error includes the note "Make sure your internet or VPN is connected" and a **Retry** button so you can re-attempt the load once connectivity is back.

## Active context and namespace

Karse tracks two independent selections:

- **Active** (tab-local): the context or namespace the current browser tab is using. Shown with a blue `active` chip. Resets on page reload.
- **Default** (persisted): the value written into your kubeconfig. Shown with a neutral `default` chip. Survives reload. Affects `kubectl` in your terminal.

Both selections start at the same value on first load. You can diverge them — for example, switch the active context in the tab without changing your terminal default.

### Header shortcuts

The header bar has two quick-picker buttons:

- **Context picker** (link icon, `Ctrl+K`): opens a searchable list of contexts. Click a row to switch the active context for the tab.
- **Namespace picker** (layers icon, `Ctrl+Shift+K`): opens a searchable list of namespaces for the active context. Click "All namespaces" to clear the namespace selection, or click a namespace name to scope all views to that namespace.

The header also has a dropdown showing the current context and a **Refresh** button (circular-arrows icon) that empties the on-disk cluster-data cache and re-fetches all data fresh from the cluster. While it is working the icon spins and a "Refreshing…" toast appears at the bottom of the window, and it shows a brief check and a "Refreshed" toast when done, so you can tell a refresh happened even when the data comes back unchanged. See the Config page below for the cache.

### Page help: where this data comes from

The header's **question-mark button** ("Where does this data come from?") opens a panel for whatever page you are on. It answers two things:

- **Where this data comes from**: which cluster queries Karse ran to build the page. For example, the Errors feed is derived (Kubernetes has no "error" object): Karse combines the Warning events with the pods and their failing containers.
- **Run it yourself**: the exact read-only `kubectl` commands behind the page, each with a copy button. They are pinned to your selected context (`--context <name>`) and scoped to your selected namespace (`-n <namespace>`, or `-A` when no namespace is selected), so you can paste one into a terminal and get the same information the page is showing. A detail page's commands use that resource's own namespace.

A command may carry a placeholder in angle brackets where the value is yours to fill in: `<pod>` on the Logs page (whichever pod you pick), and `<selector>` on a workload's detail page (the workload's own `spec.selector.matchLabels`, which is how Karse finds the pods it owns). Substitute it and the command runs as-is.

Karse never runs a command on your behalf from this panel; it only shows you what it ran and what you can run. Pages with no cluster data behind them (About, Config) have no question-mark button. For commands that *act on* a resource (delete, scale, drain), see the **Commands** tab on that resource's detail page.

### Timestamp format

Karse shows every timestamp (a resource's age, an event's last-seen, an error's age, a node condition's last transition, the log stream's last-updated caption) in one of two formats. The **timestamp format** button in the header switches between them:

- **Age** (clock icon, the default): the time since it happened, e.g. `2d`, `4h`, `37m`. This is how `kubectl get` reports age.
- **Local time** (calendar icon): the absolute time in your own timezone, e.g. `14 Jul 2026, 09:23:45`.

One click switches every timestamp in the app at once, and the choice is remembered across navigation and page reloads. Sorting is unaffected: an Age column always sorts by the real timestamp behind the cell, whichever format is shown.

Two fields are deliberately left alone: **First seen** and **Last seen** on the event and error detail pages always show the absolute local time with the age in parentheses, because reporting the absolute time is what they are for.

## Contexts page (`/contexts`)

A table of all kubeconfig contexts. Each row shows the context name, cluster, user, and default namespace.

- **Set as active**: makes this context the active one in the current tab.
- **Set as default**: writes this context as the current context in your kubeconfig (`kubectl config use-context`).
- **active** chip: this context is active in the current tab.
- **default** chip: this context is the kubeconfig current context.

## Cluster home page (`/`)

The cluster home page has two tabs: **Overview** (the default) and **Resource utilization**. The selected tab is remembered in the URL (the second tab keeps its original `?tab=performance` value so older shared links still work), so a reloaded link reopens the same tab.

### Overview tab

#### Stat tiles

Cards across the top summarise the active context: **Server version** (the Kubernetes API server version, `-` if unreachable), **Nodes** (with a "ready of total" sublabel), **Namespaces**, **Pods** (with a running count), and **Errors**.

#### Node-utilization summary strip

A strip of three cards classifying the cluster's nodes by their **CPU-requests** share of allocatable: **Over-utilized** (≥ 85%), **Healthy** (40–85%), and **Under-utilized** (< 40%). The counts come from the cluster performance snapshot and match the bands you would read on the Nodes page. The strip is omitted entirely (rather than shown as all zeros) when no node's CPU requests and allocatable are readable.

#### Pod status

A **POD STATUS** row counting the cluster's pods by phase: **Running**, **Pending**, **Failed**, and **Succeeded**.

Each count is a link. Click one to open the [Pods page](#pods-page-pods) with its **Status** filter already set to that phase, so you go straight from "3 failed" to the three failed pods. The filter arrives switched on and visible — the Filter button reads "Filter: 1 selected" — so you can see it is applied and clear it (or add more values) like any filter you set by hand.

A count of **0** is still a link: it opens the pods list filtered to that phase, which shows an empty result with the filter applied, rather than silently showing every pod. Clear the filter there to get the full list back.

#### Cluster-wide resources

A **CPU** card and a **Memory** card showing the cluster's consumption against its total allocatable, with the shared **Usage / Requests** and **% / Absolute** toggles (see [Resource utilization toggles](#resource-utilization-toggles) below). In Usage view the cards read live usage ÷ cluster allocatable; in Requests view, summed pod requests ÷ cluster allocatable. If the cluster has no Metrics API, the usage cards show an em-dash and a "Metrics API not available" notice while the requests cards still populate from pod specs.

#### Health signals

Five tiles derived from the same snapshot: **Pending pods**, **OOMKills** (a point-in-time count of containers currently reporting an `OOMKilled` last-termination reason — not a 24-hour history), **CPU throttling** (a permanent "Not available" tile, since kubectl cannot report throttling), **Node count**, and **Node pressure** (per-condition Memory/Disk/PID counts, highlighted when any node is under pressure).

#### Workloads

A searchable, sortable table with one row per top-level controller (a Deployment, StatefulSet, DaemonSet, or bare Pod), showing each workload's CPU and Memory consumption as bars (a share of the cluster total) and a Status badge, all driven by the shared toggles. The CPU/Memory headers and the Status meaning change with the View mode (Usage grades each workload against its own request; Requests flags a workload claiming a large share of the cluster). Click a row to open that workload's detail page where one exists.

### Resource utilization toggles

Two shared toggles drive every utilisation surface that carries bars or cards:

- **View** — **Usage** (live CPU/memory consumption from the Metrics API) or **Requests** (CPU/memory reserved by pod specs). Default **Usage**.
- **Value format** — **%** (a percentage of the surface's base) or **Absolute** (a `used / total` figure, e.g. `1.6 / 4 vCPU`, `2.0 / 8 GB`). Default **%**.

The percentage base depends on the scope: cluster cards and the workloads table use the cluster total; the nodes table and node detail use the node's allocatable; the pods table and pod detail use the pod's own request. Within a page section one choice drives every bar together. Where usage is unavailable (no Metrics API) a usage bar shows an em-dash and an empty bar rather than a fabricated zero, while requests bars still render.

### Resource utilization tab

A point-in-time **node treemap** of cluster CPU or memory usage, read from the Kubernetes Metrics API. A **CPU / Memory** toggle at the top selects which metric the treemap sizes by (CPU by default). Each box is one cluster node, sized by that node's usage for the selected metric, labelled with the node name and its share of the cluster, and coloured green→amber→red by utilisation. A long node name is **middle-truncated** in the box label (the start and end kept, the middle replaced with `...`); the hover tooltip shows the full untruncated name. Click a box to open that node's detail page on its Resource utilization tab.

If the cluster has no Metrics API (no metrics-server installed), the treemap is replaced by an information notice: live usage cannot be read.

## All resources page (`/all-resources`)

One combined, read-only table of every resource in the active context's cluster across all kinds Karse lists (pods, nodes, namespaces, deployments, stateful sets, daemon sets), so you can find anything in one place instead of visiting each kind's own page.

- Columns: **Kind**, **Namespace** (blank for cluster-scoped kinds like Node and Namespace), **Name**, **Status** (the kind's phase, status, or ready ratio), **Age**, and **Labels**.
- **Search**: type in the search box to filter rows by the displayed text (including labels), the same fuzzy search as the other tables.
- **Sort**: click a column header to sort by it; click again to reverse.
- **Filter**: use the **Filter** dropdown (filter icon) to restrict by **Kind** (tick one or more kinds), by **Health** (Healthy / Error), or by a label key. See [Column filtering](#column-filtering) below.
- **Row navigation**: click a row to open that resource's own detail page. Rows for a kind without a detail page are not clickable.
- Like the other tables, the page respects the active namespace: namespaced kinds scope to it, while cluster-scoped kinds (nodes, namespaces) always show.

## Nodes page (`/nodes`)

A read-only table of the cluster's nodes:

- **Name**, **Status** (Ready/NotReady/Unknown chip), **Version**, **Age**, and a **Roles** column that is **hidden by default** (it usually reads `<none>` on real clusters; reveal it from the **Columns** button if you want it).
- **CPU** and **Memory** columns: inline utilisation bars with a right-aligned monospace value, each a percentage of the node's own allocatable. They follow the shared **Usage / Requests** and **% / Absolute** toggles in the toolbar (see [Resource utilization toggles](#resource-utilization-toggles)). A node with no usage reading shows an empty bar and an em-dash in Usage view.
- **Utilization** column: a status badge classifying the node by its active-mode CPU figure (Over-utilized ≥ 85%, Under-utilized ≤ 35%, else Healthy). It re-bands when you switch Usage ↔ Requests.
- **Instance Type** column: the node's cloud instance type (from its instance-type label) in monospace, or an em-dash when the node has no such label.

Click the **CPU** or **Memory** header to sort by that column's percentage in the active View mode; click any other header to sort; type in the search box to filter rows. Use the **Filter** dropdown (filter icon, beside the search box) to filter on any of the table's columns: tick **Status** values to show only nodes with those statuses, tick **Health** values to show only **Healthy** or only **Error** nodes (matching the stats header), or tick values under a label key. See [Column filtering](#column-filtering) below. Click the **Columns** button to open a modal where you can drag columns to reorder them and drag them between Visible and Hidden to show or hide them; the layout is saved per table and persists across reloads. The Columns button is available on every resource table.

A node's detail page also has a **Pods** tab and a **Resource utilization** tab carrying utilisation surfaces.

The **Pods** tab lists the pods scheduled on the node with sortable **CPU** and **Memory** bar columns, each the pod's share of the node's allocatable, driven by the shared **Usage / Requests** and **% / Absolute** toggles at the top of the panel. Click a row to open that pod's detail page.

The **Resource utilization** tab shows the node's point-in-time CPU and memory usage, scoped to that one node. At the top are two **utilisation cards** (CPU and Memory) showing the node's consumption against its allocatable, with their own **Usage / Requests** and **% / Absolute** toggles (independent of the treemap's metric toggle below). Below them, a **CPU / Memory** toggle selects which metric the **Breakdown** treemap sizes by (CPU by default): the node's usage drilled namespace → pod, with each pod box sized by the pod's share of the node (pod usage ÷ node allocatable) and coloured green→amber→red by how close it is to its limit. Hover a box to see a tooltip with its label and figure; click a box to open the owning pod's detail page on its Resource utilization tab. The view is read-only.

If the cluster has no Metrics API, the Breakdown treemap needs live usage it cannot get, so the tab shows a short note in place of the treemap explaining the share of the node cannot be computed. The utilisation cards still show the node's requests; their usage figures read an em-dash.

### Pod detail Resource utilization tab

A pod's detail page has a **Resource utilization** tab showing the pod's point-in-time CPU and memory usage, scoped to that one pod (the leaf of the feature). It has a **CPU** section and a **Memory** section, each with three tiles — **Requested**, **Limit**, **Usage now** — over a combined bar that plots live usage against the request and limit on a shared per-resource scale, with a small Usage/Request/Limit legend, so over- and under-provisioning is easy to spot. There is no treemap at the pod level.

A **Percentage / Absolute** toggle (default Absolute) drives both sections: in Absolute the tiles read the raw figures (CPU in m/cores, memory in binary units); in Percentage each reads as a percentage of the pod's own request. An unset request or limit, or an absent usage reading, shows an em-dash rather than a fabricated zero.

If the cluster has no Metrics API, an information notice is shown above the sections and the Usage figures read an em-dash, while the Requested and Limit figures still render from the pod spec.

## Namespaces page (`/namespaces`)

A table of namespaces for the active context.

- **Resources** column: the number of pods in each namespace. Click the header to sort by count. If the count cannot be determined it shows an em-dash (`—`); the table still lists the namespaces.
- **Set as active / Clear active**: sets or clears the tab-local namespace selection.
- **Set as default / Clear default**: writes or removes the default namespace for this context in your kubeconfig.
- **active** chip: this namespace is currently active in the tab.
- **default** chip: this is the kubeconfig default namespace for the active context.
- **Click a row** (anywhere except the action buttons) to open that namespace's detail page.

## Namespace detail page (`/namespaces/:name`)

Reached by clicking a namespace row. Organised into five tabs:

- **Status**: the namespace's status (its lifecycle phase, e.g. Active/Terminating), age, annotations, and any resource quotas and limit ranges.
- **Resources**: a searchable, sortable table of the resources in the namespace (pods, deployments, stateful sets, daemon sets). Click a row to open that resource's own detail page.
- **Labels**: the namespace's own labels as a searchable, sortable Key / Value table (see [Labels tab](#labels-tab-on-detail-pages) below).
- **Commands**: copy-only `kubectl` command suggestions for the namespace. Karse never runs them.
- **YAML**: the namespace's raw YAML.

## Autoscalers page (`/autoscalers`)

A read-only table of the cluster's horizontal pod autoscalers (HPAs) and how each one is performing. When a namespace is active the table is scoped to it; otherwise every namespace is shown.

- **Name**, **Namespace**, **Reference** (the workload the HPA scales, e.g. `Deployment/nginx` — click it to open that workload's detail page), **Min** and **Max** (the HPA's replica bounds), **Age**, and **Labels**.
- **Targets**: an inline bar showing the HPA's current metric against the target it steers to. The bar fills to the current reading as a share of the target, so a full bar means the metric is *at* its target and the HPA is about to scale up; the value beside it reads, e.g., `cpu 40%/80%` (current/target). An HPA that scales on several metrics shows them all, comma-separated. If the cluster has no Metrics API the current reading is unknown: the bar is empty and the value shows an em-dash (`cpu —/80%`) rather than a fabricated zero. An HPA with no metrics reads `<none>`.
- **Replicas**: an inline bar showing how much of its maximum scale the HPA is using (current replicas ÷ **Max**), with the value reading current over desired replicas (`4/6` while it is scaling up, `4/4` once settled). A full bar means the HPA is maxed out and cannot add replicas.
- **Sort** by any column (the Targets and Replicas columns sort by the number behind the bar, so "which autoscaler is under most pressure?" is one click) and **search** across every column, including labels.
- Rows are not clickable: Karse has no HPA detail page. Use the **Reference** link to reach the workload the HPA scales.
- Like every Karse view this page is **read-only**: it shows how an autoscaler is performing and never offers a way to scale, edit, or delete anything.

## Pods page (`/pods`)

A table of pods for the active context. When a namespace is active, pods are scoped to that namespace; when no namespace is selected, all pods across all namespaces are shown. The Namespace column is always shown regardless of the active namespace.

The table has **CPU** and **Memory** utilisation bar columns (each a percentage of the pod's own request) and a **Utilization** status badge, driven by the shared **Usage / Requests** and **% / Absolute** toggles in the toolbar (see [Resource utilization toggles](#resource-utilization-toggles)). In Usage view a bar reads usage ÷ request and the badge grades it (Under-provisioned / OK / Over-reserving); in Requests view the bar shows the request and the badge is omitted. A pod with no usage reading shows an em-dash.

Type in the search box to filter rows. Use the **Filter** dropdown (filter icon, beside the search box) to filter on any of the table's columns: tick **Status** values to show only pods with those statuses, tick **Health** values to show only **Healthy** or only **Error** pods (matching the stats header), or tick values under a label key. The Deployments, StatefulSets, and DaemonSets pages have the same **Filter** dropdown (Health plus label keys). See [Column filtering](#column-filtering) below.

A Labels column shows each resource's labels as compact `key=value` chips (also present on the Nodes, Deployments, StatefulSets, DaemonSets, and Namespaces tables). The chips participate in the table's search, so typing a label key or value filters the rows. When a resource carries more labels than fit on one row, only the first three chips are shown and the rest sit behind a `+N ...` chip: click it to open the [labels modal](#labels-modal) with the full set.

The search box matches across every column, not just the name. So you can also find resources by where they live: type a **node** name to keep the pods on that node, or a **namespace** to keep the resources in that namespace. Namespace search works on every namespaced table (pods, deployments, stateful sets, daemon sets, events, errors); node search applies to the pods table.

### Column filtering

Every resource table has one shared **Filter** dropdown (filter icon) beside its search box. It can filter on any of the columns that table makes filterable: Status, Health, the error/event Type, and one group per label key present on the loaded rows. Each group is headed by the column name with one checkbox per distinct value. Tick values to narrow the table:

- Within one column, ticking several values shows rows matching any of them.
- Across different columns, the table shows only rows that match every column you have ticked a value in.
- Nothing is ticked by default, so the filter is off, all rows show, and the button reads "Filter: All". Once you pick values it reads "Filter: N selected".
- The editor has a search input at the top that filters the shown options by column name or value text, so you can quickly find a column or value to filter on.
- "Clear" at the top clears every selection and returns to showing everything.
- The filter works together with the search box: a row must satisfy the filter and the search.

### Labels modal

A table row has no space for a long label set, so the Labels column shows only the first three `key=value` chips and hides the rest behind a `+N ...` chip. Clicking that chip opens the **labels modal**: every label on that one resource, as a Key / Value table.

- The title names the resource whose labels these are (its kind and name, e.g. `Pod web-1 labels (5)`), so you always know whose labels you are looking at.
- Click a column header to sort the rows by Key or Value (ascending, then descending).
- Type in the search box to filter the rows to matching labels; a query that matches nothing shows "No labels match the search."
- Dismiss the modal with the close button, the **Escape** key, or a click outside it.
- Opening the modal does not follow the row's link, so you stay on the list.

The same modal is used by every table with a Labels column (Pods, Nodes, Deployments, StatefulSets, DaemonSets, Namespaces, and All Resources), so labels are read the same way wherever you meet them. Its Key / Value table is the same searchable, sortable table the Labels tab shows.

### Time-range filtering

The time-based views — the **Events** page (`/events`), the **Errors** page (`/errors`), and the **Logs** page (`/logs`, and the Logs tab on a pod) — have a **Range** button (clock icon), which scopes the view by how old each item is. Open it and choose either:

- **All time**: no lower bound; every row shows, however old.
- **Last X \<period\>**: type a whole number and pick a period (minutes, hours, days, weeks, or months). Only rows at least that recent are shown.

Details worth knowing:

- The default is **Last 7 days**. It is view state, not a saved preference: reloading returns to the default.
- A week is 7 days and a month is 30 days, so "Last 1 month" means "the last 30 days", not the calendar month.
- On Events and Errors the range works together with the search box and the Filter dropdown — a row must satisfy all three. If the range excludes everything, you get the usual "No events/errors match the search." message.
- On Events and Errors, a row whose timestamp is missing or unreadable is kept rather than hidden, so nothing disappears just because its age is unknown.

**What the range can and cannot show you.** Karse stores nothing itself: it reads live cluster state through `kubectl` on each request, so these views only ever show what the cluster still holds.

- **Events**: Kubernetes garbage-collects events at its `--event-ttl` (**1 hour** by default), so the Events page rarely holds anything older than an hour whatever range you pick. The default 7-day range therefore excludes nothing in practice; the useful settings here are the sub-hour ones ("Last 15 minutes", "Last 1 hour"), for narrowing a busy feed. Widening to "All time" cannot bring back an event Kubernetes has already discarded — nothing can.
- **Errors**: an error's age comes from the pod's start time for a problem-pod row, and those track live pod state rather than an expiring event. A pod that has been broken for a month is genuinely a month old, so it falls outside the 7-day default and only appears once you widen the range. This is where the control earns its keep: the default keeps recent breakage in view without a long-standing failure crowding it out, and "All time" shows you everything that is currently wrong.
- **Logs**: pressing Stream does not start you from an empty screen. Karse asks for the last 100 lines each pod has *already* written before it starts following, so the viewer immediately fills with that backlog — and for a pod that has been quiet, those lines can be hours or days old. That backlog is what the range bounds. Set it to "Last 15 minutes" and you get only the lines written in the last fifteen minutes, plus whatever arrives live from then on.

**The Logs range works differently from the other two, in a way you can see.** On Events and Errors the rows are already fetched and the range just hides some of them, so changing it is instant and reversible. On Logs the range is applied *when the lines are fetched*: Karse asks the cluster only for lines newer than your cutoff, so the excluded ones are never sent. Two things follow:

- **Changing the range restarts the stream.** The viewer clears and refills with a fresh backlog for the new range. Widening the range is how you get older lines back — they were never on your machine to un-hide.
- **The range cannot recover more than the last 100 lines per pod.** The line cap and the time range apply together: you get at most 100 lines of backlog per pod, and none older than the range. Widening to "All time" lifts the age bound, not the line cap.

### Labels tab on detail pages

Every resource detail page that carries labels (pod, node, namespace, and the workload pages: deployment, stateful set, daemon set) has a **Labels** tab. It shows only that one resource's own labels, as a Key / Value table:

- Click a column header to sort the rows by Key or Value (ascending, then descending).
- Type in the search box to filter the rows to matching labels.
- A resource with no labels shows "This resource has no labels."

This is per detail page and per resource: it shows the labels of the one resource you are viewing, never an aggregate across resources. (Container detail pages have no Labels tab, since containers carry no labels of their own.)

Click a pod row to open its detail page (`/pods/:namespace/:name`), with tabs for Status, Containers, Init Containers (when present), Labels, Logs, Commands, and YAML.

## Events and Errors pages (`/events`, `/errors`)

The Events page lists the cluster's Kubernetes events; the Errors page lists its error conditions (Warning events plus pods in a problem state). Both are sortable and searchable, and both have the shared **Filter** dropdown described in [Column filtering](#column-filtering) (event Type on Events, Reason on Errors).

### Taming a noisy feed (the "..." row menu)

A busy cluster reports the same few events and errors over and over. To cut through it, each row ends with a **"..."** button. It opens a menu of six actions — three that hide, three that show only:

| Action | What it matches |
|---|---|
| **Hide all like this** / **Show only ones like this** | every event/error *like* this one, from **any** service |
| **Hide all like this, for this service** / **Show only ones like this, for this service** | every one like this, from **this service only** |
| **Hide all from this service** / **Show only this service** | **everything** from this service, whatever it says |

#### What counts as "like this"

Two items are "like" one another when they share a **reason** and a **message**, with the parts of the message that say *where* it happened taken out and the parts that say *what* happened left in.

- Taken out: the object's name, the namespace, the name of any other object Kubernetes named (so a replicaset's "Created pod: web-7d9f8b6c5-x2k9p" groups with the same event for its other pods), pod UIDs, and IP addresses. The same failure on two different pods, or in two different services, is one kind of problem.
- Left in: **every other number**. "Container exited with code 1" and "Container exited with code 137" (an out-of-memory kill) are *not* alike, and neither is a 404 probe failure and a 500. Hiding one never hides the other.

A **service** is the workload an item came from: the object's name with the suffixes Kubernetes adds taken back off, so `web-7d9f8b6c5-x2k9p` (a pod), `web-7d9f8b6c5` (its replicaset), and `web` (its deployment) are all the service `web`. This works for objects Kubernetes named itself — pods of a deployment, daemonset, job or statefulset, and their replicasets and jobs. An object named some other way (a pod you made by hand, or one an operator named its own way) is treated as a service of its own, under its full name; it is never merged into someone else's.

Grouping errs on the side of hiding **less** than you asked rather than more. If it cannot be sure two items are alike, it leaves them apart: you may have to hide two groups instead of one, but you will never lose something you did not mean to hide.

#### Seeing what you are about to hide

Every action in the "..." menu tells you what it covers **before** you click it: how many of the loaded events (or errors) it takes in, and the group it is keyed on — the reason plus the normalised message, or the service for a whole-service action. So "Hide all like this" might read:

> Matches 3 of 4 events: "BackOff: back-off restarting failed container app in pod &lt;object&gt;" from any service

Filters build up as you add them. While a "show only" filter is active, an item has to match one of them to appear; a "hide" filter then removes anything it matches, so hiding always wins.

And once a filter is on, you can still see what it is doing:

- The count beside the Filter dropdown reads "N of M events" (or errors) — how many are shown out of the total, so hidden items are reflected in the count.
- While any row filter is active, a bar above the table says how many items are hidden and shows one chip per active filter. Each chip names the service the filter reaches and the group it hides, so nothing is hidden by an unlabelled filter; hover a chip for the whole of it. Click a chip's X to drop just that filter.
- **Reset filters** on that bar clears every row filter and brings the full list back.

The filters last for the session only; they are not saved, and they do not change the **Errors** stat tile on the cluster home page (a cluster-wide count from the server).

## Container detail page (`/pods/:namespace/:name/containers/:container`)

On a pod's detail page, open the **Containers** (or **Init Containers**) tab and click a container row to drill into that single container. The container detail page has four tabs:

- **Status**: the container's pod, namespace, image, state, ready, and restart count.
- **Logs**: the log viewer scoped to that one container (auto-streams; no container selector since only one container is shown).
- **Commands**: copy-only kubectl commands for the container, e.g. `kubectl logs <pod> -c <container>` and `kubectl exec -it <pod> -c <container> -- sh`.
- **YAML**: the raw YAML of the parent pod (a container is part of the pod's spec).

Breadcrumbs show the full trail: Pods > namespace > pod > container > tab.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `KARSE_PORT` | `5172` | Port the backend listens on. |
| `KARSE_FRONTEND_PORT` | `5173` | Port the Vite frontend listens on. |
| `KARSE_LOGS_DIR` | `../logs` (repo root `logs/`) | Directory for audit log files. Set to an absolute path to write logs elsewhere. |
| `KARSE_CACHE_DIR` | `../cache` (repo root `cache/`) | Directory for the on-disk cluster-data cache. Set to an absolute path to cache elsewhere. |

## Config page (`/config`)

Karse caches read-only cluster data fetched with `kubectl` on disk (under `cache/`) so it does not re-run `kubectl` on every request. The **Config** page (gear icon in the sidebar) controls the cache:

- **Staleness threshold (seconds)**: how long a cached read is served before Karse re-fetches it from the cluster. Lower it for fresher data, raise it to spare more kubectl calls. Set it to **0** to disable the cache entirely. The value is saved server-side and persists across restarts.
- The navbar **Refresh** button empties the cache (the threshold is kept) and re-fetches, so you always have a one-click way to get fresh data regardless of the threshold.

## Audit log

Every kubectl call Karse makes is logged to a rolling text file under `logs/<YYYY>/<MM>/<DD>/<HH>.log` at the repo root, one file per hour. Logs are kept for 3 months. See `docs/audit-log.md` for details.

## Troubleshooting

- **Tiles or table show an error**: the message is kubectl's own stderr. Check that your context is valid and the cluster is reachable.
- **Server version shows `-`**: the API server could not be reached for the version call, though other queries may still work.
- **Nothing loads and no context is shown**: no current context is set. Run `kubectl config use-context <name>` or use the context picker in the header.
- **Frontend cannot reach the backend**: make sure the backend is running on port 5172.

## More

- `docs/roadmap.md`: what is planned and what has shipped.
- `docs/architecture.md`: how Karse is built.
- `docs/api.md`: the HTTP API behind the UI.
