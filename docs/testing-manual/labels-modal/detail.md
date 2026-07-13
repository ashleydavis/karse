# labels-modal manual tests

Manual tests for the shared labels modal. See the spec: [labels-modal](../../spec/labels-modal/detail.md).

A resource table's Labels column shows at most three `key=value` chips inline; the rest sit behind a `+N ...` chip. Clicking that chip opens the labels modal, which lists every label on that one resource as a searchable, sortable Key / Value table. The same modal serves every table with a Labels column.

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear the cluster down with the Teardown step at the end of this doc.

## Scenario: Truncated labels open the modal

Three pods in `default`: `many-pod` with five labels (more than fit inline), `web-pod` with two, and `db-pod` with one. Also a `web-deploy` deployment (two labels) and a `fake-node-1` node with five labels, so the Nodes table truncates and opens the modal too.

**Fixture:** [_fixtures-kwok/33-labels-column](../_fixtures-kwok/33-labels-column/)

```sh
./docs/testing-manual/_fixtures-kwok/33-labels-column/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### Truncation indicator

- Navigate to `/pods`.
- The `many-pod` row's Labels column shows exactly three `key=value` chips followed by a `+2 ...` chip. The row height matches the other rows: the labels do not wrap or overflow.
- The `web-pod` row shows both its labels (`app=web`, `tier=frontend`) and **no** `+N ...` chip: nothing is truncated, so no modal is reachable for it.
- The `db-pod` row shows its single label and no `+N ...` chip.

### Opening the modal

- Click the `+2 ...` chip on the `many-pod` row.
- A modal opens, titled **Pod many-pod labels (5)** — it names the resource whose labels these are (kind + name), then its total label count, not the three shown inline.
- You are still on the pods list: clicking the chip opened the modal instead of navigating to the pod's detail page.
- The modal lists **all five** labels as a two-column Key / Value table, one row per label, ordered by key: `app` / `many`, `env` / `prod`, `region` / `eu-west`, `tier` / `backend`, `version` / `1.2.3`.

### Sorting

- Click the **Key** column header. The rows sort by key ascending (the initial order) and the sort-direction icon updates. Click it again: the rows reverse to descending (`version` first, `app` last).
- Click the **Value** column header. The rows sort by value ascending: `1.2.3`, `backend`, `eu-west`, `many`, `prod`. Click again for descending.

### Searching

- Type `region` into the modal's search box. Only the `region` / `eu-west` row remains — the search matches on the label **key**.
- Clear it and type `backend`. Only the `tier` / `backend` row remains — the search matches on the label **value**.
- Type a string that matches nothing (e.g. `zzzznope`). The table shows "No labels match the search."
- Clear the search box. All five rows return.

### Dismissing

- With the modal open, press the **Escape** key. The modal closes and you are still on the pods list.
- Re-open it, then click the **X** close button in the modal's title bar. It closes again.
- Re-open it, then click outside the modal (on the backdrop). It closes.
- After each dismissal you remain on `/pods`: the modal never navigates away.

### Reused across resource tables

The modal is one shared component, not a pods-only feature. Confirm the same modal opens elsewhere:

- Navigate to `/all-resources`. Find the `many-pod` row: its Labels column truncates to `+2 ...` in the same way.
- Click the `+2 ...` chip. The same modal opens, now titled **Pod many-pod labels (5)** (the all-resources row supplies its own kind), with the same sortable and searchable Key / Value table. Sort and search behave exactly as above.
- Dismiss it with Escape.

Then check the **Nodes** table, which is the table this modal was once unreachable from:

- Navigate to `/nodes`. The `fake-node-1` row's Labels column shows three chips followed by a `+2 ...` chip (the fixture gives the node five labels).
- Click the `+2 ...` chip. The same modal opens, now titled **Node fake-node-1 labels (5)**, listing all five of the node's labels.
- Leave it open for a few seconds. It **stays** open, and the table underneath stays still. (The nodes table used to re-render continuously, which destroyed and rebuilt the row on every frame: the chip could not be clicked at all, and a modal that did open would immediately close itself. If the modal will not open, or opens and vanishes, that render loop is back.)
- Sort and search inside it, then dismiss it with Escape. You remain on `/nodes`.

The Deployments, StatefulSets, DaemonSets and Namespaces tables use the same Labels cell, so any resource with more than three labels truncates and opens this same modal there too. (This fixture's deployment carries two labels, so it shows no `+N ...` chip.)

### Same table as the Labels tab

- Click the `many-pod` row to open its detail page, then the **Labels** tab.
- The tab shows the same Key / Value table, with the same sorting, the same search box, and the same "No labels match the search." message. The modal and the tab render one shared table component, so they cannot drift apart.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/33-labels-column/teardown.sh
```
