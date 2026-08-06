# multi-cluster-overview: manual test steps

**Feature:** [multi-cluster-overview](../../spec/multi-cluster-overview/detail.md)

The All clusters page (`/clusters`) summarises every configured kubeconfig context at once: how many clusters, how many nodes across them, and their aggregate CPU and memory utilisation, above a per-cluster table.

## Before you start

Build the two-context fixture:

```sh
bash docs/testing-manual/_fixtures-kwok/13-two-contexts/setup.sh
```

Then start the app from the repo root:

```sh
bun run dev
```

Open the frontend at `http://127.0.0.1:5173`.

When you are finished, tear the fixture down:

```sh
bash docs/testing-manual/_fixtures-kwok/13-two-contexts/teardown.sh
```

## 1. The page is reachable from the left nav

1. In the left sidebar, click **All clusters** (the globe icon, directly above **Cluster**).
2. Expect the URL to become `/clusters` and the page to render an **Across all clusters** card row above a **Clusters** table.
3. Expect the nav item to be highlighted, and **Cluster** below it to be unhighlighted.

## 2. It summarises every context, not just the active one

1. Note which context is active in the navbar context picker.
2. On the All clusters page, expect the **Clusters** table to have one row per context in your kubeconfig (two, with the fixture), not just the active one.
3. Expect each row to show its context name, the cluster it points at, that cluster's node count, and CPU and memory bars.
4. Expect the **Clusters** card to read the number of configured contexts and the **Nodes** card to read the sum of the per-row node counts.

## 3. Rows arrive progressively, with the shared loading indicator

1. Set the cache staleness threshold to `0` on the **Config** page, so nothing is served from cache and every visit re-queries.
2. Return to **All clusters** and reload the page.
3. Expect the shared loading spinner (the large circular indicator) to be visible while the reads are outstanding, and rows to appear in the table underneath as each cluster answers, rather than the whole table appearing at once at the end.
4. Expect the spinner to disappear and the **Across all clusters** cards to appear once every cluster has reported.
5. Set the staleness threshold back to `60` on the **Config** page.

## 4. The totals reuse the per-cluster page's toggles

1. On the All clusters page, find the **Usage | Requests** and **% | Absolute** toggles at the top right of the card row.
2. Click **Absolute**. Expect the CPU and Memory cards to switch from a percentage to an absolute figure (e.g. `1.2 / 14 cores`), and the per-cluster table's CPU and Memory bars to switch with them.
3. Click **Requests**. Expect the cards and the bars to show requested resources rather than live usage.
4. Switch back to **Usage** and **%**.
5. Open the **Cluster** page's **Overview** tab and compare its Cluster-wide resources cards for the active context against that context's row on All clusters. Expect the same figures, presented the same way.

## 5. A row links through to its cluster

1. On All clusters, note the node count of the row that is **not** your active context.
2. Click that row.
3. Expect to land on `/cluster?context=<that context>`, the cluster home page.
4. Expect its **Nodes** stat tile to show the node count you noted, and the navbar context picker to show that context: following the row made it active.

## 6. An unreachable context is an error row, and the totals say so

1. Add a kubeconfig context pointing at a server that is not there:

   ```sh
   kubectl config set-cluster karse-dead --server=https://127.0.0.1:1
   kubectl config set-context karse-dead --cluster=karse-dead --user=karse-dead
   ```

2. Reload All clusters.
3. Expect a third row named `karse-dead` whose **Status** cell names the reason in red (a connection refused / unreachable-server message), with an em-dash for its node count, CPU and memory.
4. Expect the other two rows to still show their real figures: one dead context does not blank the page.
5. Expect the coverage line under the cards to read `Totals cover 2 of 3 clusters (1 could not be read; see the Status column below).`
6. Expect the **Clusters** card to read 3 (every configured context) and the **Nodes** card to read the sum over the two clusters that answered, captioned `across 2 of 3 clusters`.
7. Remove the dead context:

   ```sh
   kubectl config delete-context karse-dead
   kubectl config delete-cluster karse-dead
   ```

## 7. Search and sort

1. Type part of one context's name into **Search clusters...**. Expect the table to narrow to the matching row(s).
2. Clear the search with the x button. Expect every row back.
3. Click the **Nodes** column header. Expect the rows to sort by node count ascending, then descending on a second click.
4. Click the **Context** header. Expect the rows to sort by name.

## 8. A cluster with no metrics server

kwok clusters have no metrics server, so with the fixture running as above every cluster's live usage is unknown. (Under `bun run dev:test`, canned metrics are supplied instead and usage is populated.)

1. With `bun run dev` (no fake metrics), expect the CPU and Memory cards to read an em-dash in **Usage** mode, and the blue "The Kubernetes Metrics API is not available" notice to appear under the coverage line.
2. Click **Requests**. Expect real percentages: requests and allocatable come from pod specs and node status, not from the Metrics API.
3. Confirm the aggregate usage reads as an em-dash rather than `0%`: an unknown figure must not be shown as zero.

## 9. An empty kubeconfig

1. Tear down the two-context fixture and build the no-contexts one:

   ```sh
   bash docs/testing-manual/_fixtures-kwok/13-two-contexts/teardown.sh
   bash docs/testing-manual/_fixtures-kwok/12-no-contexts/setup.sh
   ```

2. Reload All clusters.
3. Expect the "No kubeconfig contexts are configured" notice followed by the same add-a-context guidance the **Contexts** page shows (the heading, the intro, and the copy-ready EKS and AKS commands), not a page of zeroes and an empty table.

## 10. Many contexts stay bounded

1. Build the many-contexts fixture:

   ```sh
   bash docs/testing-manual/_fixtures-kwok/14-many-contexts/setup.sh
   ```

2. Reload All clusters.
3. Expect one row per context, appearing in batches as the bounded fan-out works through them, and the page to stay responsive throughout (the search box still accepts typing while rows are arriving).
4. Expect the totals to appear once the last context has reported.

## 11. Read-only

1. With the page open and rows loaded, read the current hour's audit log at the repo root (`logs/YYYY/MM/DD/HH.log`):

   ```sh
   tail -n 40 "logs/$(date +%Y/%m/%d/%H).log"
   ```

2. Expect every entry from the page load to be `config view` or a `get` command. Expect no `apply`, `create`, `delete`, `patch`, `scale`, or any other mutating verb.
